// ╔═══════════════════════════════════════════════════════════╗
// ║  UTILITIES — Helpers, Toast, Error Logging, Security     ║
// ╚═══════════════════════════════════════════════════════════╝

// ── SECURITY: HTML escape to prevent XSS ──
const _escDiv = document.createElement('div');
function escHTML(str) {
  if (str == null) return '';
  _escDiv.textContent = String(str);
  return _escDiv.innerHTML;
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
  t.innerHTML = `<i class="ti ti-check"></i> ${msg}`;
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



