// ╔═══════════════════════════════════════════════════════════╗
// ║  UTILITIES — Helpers, Toast, Error Logging, Security     ║
// ╚═══════════════════════════════════════════════════════════╝

// ── SECURITY: HTML escape to prevent XSS ──
const _escDiv = document.createElement('div');
function escHTML(str) {
  if (str == null) return '';
  _escDiv.textContent = String(str);
  // .innerHTML alone only encodes & < > — that's enough for text nodes, but
  // not for values dropped inside an attribute (value="${...}"), where a
  // stray " can break out. Encoding quotes too makes this safe in both spots.
  return _escDiv.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── ERROR LOGGING ──
// In-memory buffer of recent errors — attached to bug reports automatically.
// Capped at 20 so it doesn't grow unbounded across a long session.
const _errorBuffer = [];
const _ERROR_BUFFER_MAX = 20;

// Auto-inserts to Supabase error_logs. Returns the inserted row id so
// the toast "Report" button can later PATCH a user_note onto the same row.
// Requires an authenticated user — RLS blocks anon inserts.
async function _persistError(context, err) {
  if (!currentUser?.access_token) return null; // RLS requires auth — skip silently
  try {
    const payload = {
      context,
      message: err?.message || String(err),
      stack:   err?.stack   || null,
      page:    currentPage  || null,
      user_id: currentUser.id,
      url:     window.location.href,
      app_version: '1.0'
    };
    const res = await fetch(`${SUPA_URL}/rest/v1/error_logs`, {
      method: 'POST',
      headers: supaHeaders({
        'Authorization': `Bearer ${currentUser.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const rows = await res.json();
      return rows?.[0]?.id || null;
    }
  } catch(e) {
    // Truly silent — if error logging itself fails, don't create an infinite loop
    console.warn('[Hive] error_log persist failed:', e);
  }
  return null;
}

// Main error logger. Always logs to console + persists to Supabase.
// Pass toastMsg to show a user-facing toast with a "Report" button.
async function logError(context, err, toastMsg) {
  console.error(`[Hive] ${context}:`, err);

  // Add to in-memory buffer (for bug report sheet)
  _errorBuffer.unshift({ context, message: err?.message || String(err), ts: new Date() });
  if (_errorBuffer.length > _ERROR_BUFFER_MAX) _errorBuffer.length = _ERROR_BUFFER_MAX;

  // Mark bug FAB red
  document.getElementById('bugFab')?.classList.add('has-errors');

  // Persist to Supabase — fire and forget, get row id back
  const logId = await _persistError(context, err);

  if (toastMsg) showErrorToast(`⚠️ ${toastMsg}`, logId);
}

// ── TOAST ──
let toastTimer;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.className = 'toast';
  t.innerHTML = `<i class="ti ti-check"></i> ${escHTML(msg)}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Error toast — stays longer, has a "Report" button that opens bug sheet
// pre-filled with the note field focused and the specific logId attached.
function showErrorToast(msg, logId) {
  const t = document.getElementById('toast');
  t.className = 'toast error-toast';
  t.innerHTML = `<i class="ti ti-alert-triangle"></i> <span style="flex:1;">${escHTML(msg)}</span><button class="toast-report-btn" onclick="openBugSheet('${logId || ''}')">Report</button>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}

// ── BUG REPORT SHEET ──
let _bugReportLogId = null; // if opened from a specific toast, patch that row

function openBugSheet(logId) {
  if (!currentUser) { openAuthGate(currentPage); return; }
  _bugReportLogId = logId || null;
  // Populate recent errors list
  const el = document.getElementById('bugRecentErrors');
  if (_errorBuffer.length) {
    el.innerHTML = _errorBuffer.slice(0, 5).map(e => `
      <div class="bug-error-item">
        <div class="bug-error-context">${escHTML(e.context)}</div>
        <div class="bug-error-msg">${escHTML(e.message)}</div>
      </div>`).join('');
  } else {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-light);margin-bottom:10px;">No errors recorded this session.</p>';
  }
  document.getElementById('bugNoteInput').value = '';
  document.getElementById('bugSheetBackdrop').classList.add('open');
  setTimeout(() => document.getElementById('bugNoteInput').focus(), 350);
}

function closeBugSheet() {
  document.getElementById('bugSheetBackdrop').classList.remove('open');
  _bugReportLogId = null;
}

async function submitBugReport() {
  const note = document.getElementById('bugNoteInput').value.trim();
  const btn  = document.getElementById('bugSendBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite;display:inline-block;"></i> Sending…';

  const authHeaders = supaHeaders({
    'Authorization': `Bearer ${currentUser.access_token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  });

  try {
    if (_bugReportLogId) {
      // PATCH user_note onto the existing error_log row from the toast
      await fetch(`${SUPA_URL}/rest/v1/error_logs?id=eq.${_bugReportLogId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ user_note: note || null })
      });
    } else {
      // Manual report (opened via bug FAB) — insert a fresh row
      await fetch(`${SUPA_URL}/rest/v1/error_logs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          context:    'manual_report',
          message:    note || '(no message)',
          page:       currentPage || null,
          user_id:    currentUser.id,
          user_note:  note || null,
          url:        window.location.href,
          stack:      _errorBuffer.length
            ? _errorBuffer.slice(0,5).map(e => `[${e.context}] ${e.message}`).join('\n')
            : null,
          app_version: '1.0'
        })
      });
    }
    closeBugSheet();
    document.getElementById('bugFab')?.classList.remove('has-errors');
    showToast('Report sent — thank you! 🐝');
  } catch(e) {
    console.error('[Hive] submitBugReport failed:', e);
    showToast('Could not send — please try again');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send"></i> Send report';
  }
}

const TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>';

// ── VENUE FIELD FLATTENING ──
// `deals` and `local_prices` rows no longer carry business_name, address,
// latitude/longitude etc. directly — those now live on the linked `venues`
// row (deals.venue_id / local_prices.venue_id → venues.id). Fetch callers
// should append `&select=*,venues(*)` (or a scoped `venues(col,col)`) so
// PostgREST embeds the venue as row.venues, then map every row through
// this helper to flatten those fields back onto the row itself — so every
// downstream consumer (map markers, detail pages, edit forms, search,
// carousels) keeps working exactly as if the columns still lived there.
// Also carries through price_source/last_checked_at/last_checked_by —
// powers the Source/Last Updated info popup (buildSourceInfoHTML() in
// deals.js). Callers using a scoped `venues(col,col)` select must include
// these three explicitly if they need that popup.
function flattenVenue(row) {
  const v = row && row.venues;
  if (!v) return row;
  const { venues, ...rest } = row;
  return {
    ...rest,
    business_name: rest.business_name ?? v.business_name ?? null,
    business_type: rest.business_type ?? v.venue_type    ?? null,
    country:       rest.country       ?? v.country        ?? null,
    state_region:  rest.state_region  ?? v.state_region   ?? null,
    city:          rest.city          ?? v.city            ?? null,
    address:       rest.address       ?? v.address          ?? null,
    latitude:      rest.latitude      ?? v.latitude          ?? null,
    longitude:     rest.longitude     ?? v.longitude          ?? null,
    website:       rest.website       ?? v.website          ?? null,
    contact_phone: rest.contact_phone ?? v.phone            ?? null,
    opening_hours: rest.opening_hours ?? v.opening_hours     ?? null,
    opening_hours_json: rest.opening_hours_json ?? v.opening_hours_json ?? null,
    price_source:    rest.price_source    ?? v.price_source    ?? null,
    last_checked_at: rest.last_checked_at ?? v.last_checked_at ?? null,
    last_checked_by: rest.last_checked_by ?? v.last_checked_by ?? null,
  };
}

// ── SHORT DATE FORMATTER (dd/mm/yy) ──
// Used by the Source/Last-Updated info popup (see buildSourceInfoHTML() in
// deals.js) — a plain, unambiguous absolute date rather than a relative
// "3d ago" style string, since "last checked" is meant to read as a fact
// you can double-check, not a vague freshness signal.
function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// ── TIME FORMATTER ──
// Moved here from forum.js — used by both forum.js and reviews.js.
function formatTimeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800)return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

// Formats a "HH:MM" 24h time string as "H AM/PM" on the hour, or
// "H:MM AM/PM" otherwise — e.g. "10:00" → "10 AM", "10:30" → "10:30 AM".
// Shared by the HH countdown/schedule badges (deals.js) and the
// opening-hours widget below, so easing the reading here covers the pin
// card popup, the venue detail pages, and the day-by-day dropdowns alike.
function to12h(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2,'0')} ${period}` : `${h12} ${period}`;
}

// ── OPENING HOURS WIDGET ──
// Powers the "Open · Closes at 10:00 PM ▾" row on the Deal Detail and
// Local Price Detail hero sections, backed by venues.opening_hours_json
// (see the column comment in Supabase): {"0":{"open":"HH:MM","close":"HH:MM"}|null, ...}
// keyed 0=Sunday..6=Saturday to match Date#getDay(). A day's close <= open
// means it closes after midnight the next day. Not every venue has this
// structured data yet — buildHoursWidgetHTML() falls back to the old
// free-text opening_hours/availability string (no expand arrow) when it's
// missing.
const _HOURS_DAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function _hoursToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Works out whether a venue is open right now, and the next status change,
// from its weekly opening_hours_json. Returns null if there's no data.
function getOpenStatus(hoursJson, now) {
  if (!hoursJson) return null;
  now = now || new Date();
  const day = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Still open from an overnight slot that started yesterday?
  const yesterday = hoursJson[(day + 6) % 7];
  if (yesterday && _hoursToMins(yesterday.close) <= _hoursToMins(yesterday.open) && nowMins < _hoursToMins(yesterday.close)) {
    return { isOpen: true, verb: 'Closes', time: to12h(yesterday.close), dayLabel: null };
  }

  const today = hoursJson[day];
  if (today) {
    const openMins  = _hoursToMins(today.open);
    const closeMins = _hoursToMins(today.close);
    const overnight = closeMins <= openMins; // closes after midnight tonight
    const isOpenNow = overnight ? nowMins >= openMins : (nowMins >= openMins && nowMins < closeMins);
    if (isOpenNow) return { isOpen: true, verb: 'Closes', time: to12h(today.close), dayLabel: overnight ? 'tomorrow' : null };
    if (nowMins < openMins) return { isOpen: false, verb: 'Opens', time: to12h(today.open), dayLabel: null };
  }

  // Closed for the rest of today (or today has no slot) — find the next open day
  for (let i = 1; i <= 7; i++) {
    const idx = (day + i) % 7;
    const slot = hoursJson[idx];
    if (slot) {
      return { isOpen: false, verb: 'Opens', time: to12h(slot.open), dayLabel: i === 1 ? 'tomorrow' : _HOURS_DAY_LABELS[idx] };
    }
  }
  return { isOpen: false, verb: '', time: '', dayLabel: null }; // never open, per the data
}

// Renders the full widget: a tappable summary row ("Open · Closes at
// 10:00 PM") that expands to a 7-day list, highlighting today. Falls back
// to a plain (non-expandable) text line using fallbackText when hoursJson
// is missing — most venues, until more get structured. widgetId must be
// unique in the DOM (each detail page, and the map pin card, only ever
// has one open at a time, so a fixed id per call site is fine — see
// deals.js, both the detail pages and the popupHoursWidget id used in the
// map pin card popups).
function buildHoursWidgetHTML(hoursJson, fallbackText, widgetId) {
  if (hoursJson) {
    const status = getOpenStatus(hoursJson);
    const statusClass = status.isOpen ? 'hours-open' : 'hours-closed';
    const statusLabel = status.isOpen ? 'Open' : 'Closed';
    const changeText = status.verb
      ? `${status.verb} ${status.time}${status.dayLabel ? ' ' + status.dayLabel : ''}`
      : '';
    const todayIdx = new Date().getDay();
    const weekRows = _HOURS_DAY_LABELS.map((label, idx) => {
      const slot = hoursJson[idx];
      const timeStr = slot ? `${to12h(slot.open)} – ${to12h(slot.close)}` : 'Closed';
      return `<div class="hours-week-row${idx === todayIdx ? ' today' : ''}">
        <span class="hours-week-day">${label}</span>
        <span class="hours-week-time">${escHTML(timeStr)}</span>
      </div>`;
    }).join('');
    return `
      <div class="hours-widget" id="${widgetId}">
        <button type="button" class="hours-widget-summary" onclick="toggleHoursWidget('${widgetId}')">
          <span class="hours-status-chip ${statusClass}">${statusLabel}</span>
          ${changeText ? `<span class="hours-change-text">· ${escHTML(changeText)}</span>` : ''}
          <i class="material-symbols-outlined hours-widget-arrow">expand_more</i>
        </button>
        <div class="hours-widget-week"><div class="hours-widget-week-inner">${weekRows}</div></div>
      </div>`;
  }
  if (!fallbackText) return '';
  return `<div class="hours-widget-plain"><span>${escHTML(fallbackText)}</span></div>`;
}

function toggleHoursWidget(id) {
  document.getElementById(id)?.classList.toggle('expanded');
}



