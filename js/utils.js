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

// ── HOURS DROPDOWNS (Local Price / Deal edit sheets, slide 1) ──
// Builds a <select>'s worth of "HH:MM" options in 30-min steps, each
// labeled in 12h format via to12h() above.
function buildTimeOptionsHTML(selected) {
  let html = '';
  for (let m = 0; m < 24 * 60; m += 30) {
    const val = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    html += `<option value="${val}"${val === selected ? ' selected' : ''}>${to12h(val)}</option>`;
  }
  return html;
}

// Fills the two time <select>s for a given prefix ('editLP' or 'editDeal').
// openVal/closeVal are existing "HH:MM" values (if any) to preselect.
function populateHoursSelects(openId, closeId, openVal, closeVal) {
  const openEl = document.getElementById(openId);
  const closeEl = document.getElementById(closeId);
  if (openEl)  openEl.innerHTML  = buildTimeOptionsHTML(openVal  || '09:00');
  if (closeEl) closeEl.innerHTML = buildTimeOptionsHTML(closeVal || '17:00');
}

// Picks a representative open/close pair out of a venue's existing weekly
// opening_hours_json (see the schema note above getOpenStatus()) — just
// the first day that has a slot, since the edit sheet only offers one
// uniform time for every day.
function firstHoursSlot(hoursJson) {
  if (!hoursJson) return null;
  for (let i = 0; i <= 6; i++) if (hoursJson[i]) return hoursJson[i];
  return null;
}

// Builds a full 7-day opening_hours_json applying the same open/close time
// to every day — the uniform-week simplification the edit sheets submit.
function buildUniformHoursJson(openVal, closeVal) {
  if (!openVal || !closeVal) return null;
  const json = {};
  for (let i = 0; i <= 6; i++) json[i] = { open: openVal, close: closeVal };
  return json;
}

// ── PER-DAY HOURS (Local Price edit sheet — "Different per day" mode) ──
// Mon→Sun display order, mapped to the 0=Sunday..6=Saturday keys used by
// opening_hours_json (Date#getDay()).
const _PERDAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Renders the 7 day rows into `container`, preselecting from an existing
// opening_hours_json if given (a day with no slot starts "Closed").
function renderPerDayHoursRows(container, hoursJson) {
  if (!container) return;
  container.innerHTML = _PERDAY_LABELS.map((label, i) => {
    const dayIdx = (i + 1) % 7; // Mon=1…Sat=6, Sun=0
    const slot = hoursJson ? hoursJson[dayIdx] : null;
    const closed = !!hoursJson && !slot;
    return `<div class="fc-perday-row${closed ? ' is-closed' : ''}" data-day-idx="${dayIdx}">
      <span class="fc-perday-label">${label}</span>
      <label class="fc-perday-closed-toggle">
        <input type="checkbox" class="fc-perday-closed-cb"${closed ? ' checked' : ''} onchange="this.closest('.fc-perday-row').classList.toggle('is-closed', this.checked)">
        Closed
      </label>
      <div class="fc-hours-row fc-perday-hours-row">
        <input type="time" class="form-input fc-hours-time perday-open" value="${slot?.open || '09:00'}">
        <span class="fc-hours-sep">to</span>
        <input type="time" class="form-input fc-hours-time perday-close" value="${slot?.close || '17:00'}">
      </div>
    </div>`;
  }).join('');
}

// Reads the rendered day rows back into an opening_hours_json — null for
// any day whose "Closed" box is ticked. Returns null if nothing is open.
function buildPerDayHoursJson(container) {
  if (!container) return null;
  const json = {};
  let anyOpen = false;
  container.querySelectorAll('.fc-perday-row').forEach(row => {
    const dayIdx = parseInt(row.dataset.dayIdx, 10);
    if (row.querySelector('.fc-perday-closed-cb')?.checked) { json[dayIdx] = null; return; }
    const open  = row.querySelector('.perday-open')?.value;
    const close = row.querySelector('.perday-close')?.value;
    if (open && close) { json[dayIdx] = { open, close }; anyOpen = true; }
  });
  return anyOpen ? json : null;
}

// True when an existing opening_hours_json is exactly the uniform-week
// shape (all 7 days present, all identical) — used to decide which mode
// the edit sheet should default to. Missing data also counts as "uniform"
// since there's nothing custom to show.
function isUniformHoursJson(hoursJson) {
  if (!hoursJson) return true;
  const days = Object.values(hoursJson);
  if (days.length < 7 || !days.every(Boolean)) return false;
  const first = days[0];
  return days.every(s => s.open === first.open && s.close === first.close);
}

// ── EDIT-FORM CAROUSEL ──
// Generic controller for a multi-step bottom-sheet form (see .fc-* rules
// in styles.css). Call initFormCarousel(prefix, slideCount) each time the
// sheet opens — it resets to slide 0 and (once) wires up swipe. `prefix`
// must match the ids used in the markup: #<prefix>Progress (holding one
// .fc-progress-seg per slide), #<prefix>CarouselWrap/#<prefix>CarouselTrack,
// and #<prefix>BackBtn/#<prefix>NextBtn/#<prefix>SubmitBtn.
const _formCarouselState = {};

function initFormCarousel(prefix, slideCount) {
  _formCarouselState[prefix] = { idx: 0, count: slideCount, touchStartX: null };
  goToFormSlide(prefix, 0);

  const wrap = document.getElementById(prefix + 'CarouselWrap');
  if (wrap && !wrap._fcSwipeBound) {
    wrap._fcSwipeBound = true;
    wrap.addEventListener('touchstart', e => {
      _formCarouselState[prefix].touchStartX = e.touches[0].clientX;
    }, { passive: true });
    wrap.addEventListener('touchend', e => {
      const st = _formCarouselState[prefix];
      if (!st || st.touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - st.touchStartX;
      if (Math.abs(dx) > 40) goToFormSlide(prefix, st.idx + (dx < 0 ? 1 : -1));
      st.touchStartX = null;
    }, { passive: true });
  }
}

function goToFormSlide(prefix, idx) {
  const st = _formCarouselState[prefix];
  if (!st) return;
  idx = Math.max(0, Math.min(st.count - 1, idx));
  st.idx = idx;

  const track = document.getElementById(prefix + 'CarouselTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;

  document.querySelectorAll(`#${prefix}Progress .fc-progress-seg`).forEach((seg, i) => {
    seg.classList.toggle('filled', i <= idx);
  });

  const isLast = idx === st.count - 1;
  document.getElementById(prefix + 'BackBtn')?.classList.toggle('fc-hidden', idx === 0);
  // Delete only makes sense on slide 1 (before Back appears) — cross-fades
  // with it in the same .fc-left-slot grid cell (see styles.css).
  document.getElementById(prefix + 'DeleteBtn')?.classList.toggle('fc-hidden', idx !== 0);
  const nextBtn = document.getElementById(prefix + 'NextBtn');
  const submitBtn = document.getElementById(prefix + 'SubmitBtn');
  // Both buttons share one grid cell (.fc-btn-slot) and stay in normal flow
  // at all times — toggling this class only flips opacity/visibility, so
  // Next fades into Submit instead of snapping.
  if (nextBtn) nextBtn.classList.toggle('fc-btn-hidden', isLast);
  if (submitBtn) submitBtn.classList.toggle('fc-btn-hidden', !isLast);

  // Scroll the sheet back to the top so each new step starts fully in view.
  track?.closest('.modal-sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextFormSlide(prefix) {
  const st = _formCarouselState[prefix];
  if (st) goToFormSlide(prefix, st.idx + 1);
}

function prevFormSlide(prefix) {
  const st = _formCarouselState[prefix];
  if (st) goToFormSlide(prefix, st.idx - 1);
}

// For a header Back button (as opposed to the in-row step-back button):
// steps to the previous carousel slide if there is one, otherwise runs
// `onClose` — so it behaves like a real "back", only closing the sheet
// once there's nowhere left to go back to.
function handleFormBack(prefix, onClose) {
  const st = _formCarouselState[prefix];
  if (st && st.idx > 0) {
    prevFormSlide(prefix);
  } else if (typeof onClose === 'function') {
    onClose();
  }
}



