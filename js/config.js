// ═══════════════════════════════════════════════════════════════
// THE HIVE — JavaScript source
// ───────────────────────────────────────────────────────────────
// Sections (in order):
//   1. SUPABASE CONFIG & API helpers (supaFetch, supaInsert, supaCount)
//   2. UTILITIES — escHTML, toast, error logging, bug report
//   3. MAP — tiles, theme, sun time, price-pin refresh
//   4. APP STATE & NAVIGATION — goTo, view toggles, slider
//   5. FARMS — map, list, filters, detail view
//   6. LOCAL PRICES — edit modal, map, submission
//   7. DATA HELPERS — counts, home stats, formatters
//   8. FORUM — posts, replies, likes, new post
//   9. SUBMIT MODAL — add farm / deal / price / tip
//  10. FORM VALIDATION — price rows, happy hour, local discount
//  11. PRICE DISPLAY — active prices, happy hour rendering
//  12. LISTINGS — delete, shared utilities
//  13. AUTH — session, login, register, OAuth, logout
//  14. REVIEWS — farm reviews, star ratings
//  15. COMMUNITY — map, activities, modals
//  16. ADVANCED FILTERS — farms & deals filter panels
//  17. GLOBAL SEARCH
//  18. HOME — stats, carousels, community bar
//  19. BOOTSTRAP — app initialisation, logo animation
//  20. JOBS — Poolside multi-platform job search (Adzuna API)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// SUPABASE CONFIG
// ─────────────────────────────────────────────────────────────
const SUPA_URL = 'https://xcazqvhxwjkqemumxvbu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXpxdmh4d2prcWVtdW14dmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTUyNzQsImV4cCI6MjA5NTk3MTI3NH0.AaUIUoCGyyde8yPcEGDwtANamxLRPpeTaaI7zntkcYM';


// Returns the standard read-only Supabase headers (anon key, no user token).
// For authenticated writes, build headers inline with the user's access_token.
const supaHeaders = (extra = {}) => ({
  'apikey':        SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  ...extra,
});

const PAGE_TYPE_MAP = { home: null, farms: 'farm', deals: 'price', forum: 'tip' };

// ── FORUM CATEGORY DEFINITIONS — single source of truth ──
// To add a category: add one entry here. The forum tabs, my-activity tabs,
// and post-rendering all derive from this automatically.
const FORUM_CATEGORIES = [
  { key: 'farms',   label: 'Farms',    shortLabel: 'Farm',    cssClass: 'fp-cat-farm'    },
  { key: 'deals',   label: 'Deals',    shortLabel: 'Deal',    cssClass: 'fp-cat-deal'    },
  { key: 'visa',    label: 'Visa',     shortLabel: 'Visa',    cssClass: 'fp-cat-visa'    },
  { key: 'tips',    label: 'Tips',     shortLabel: 'Tips',    cssClass: 'fp-cat-tips'    },
  { key: 'general', label: 'General',  shortLabel: 'General', cssClass: 'fp-cat-general' },
];

async function supaFetch(table, params='') {
  // Auto-paginate to get ALL rows (Supabase default cap = 1000)
  const allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: {
        ...supaHeaders(),
        'Range': `${from}-${from + pageSize - 1}`,
        'Range-Unit': 'items',
        'Prefer': 'count=none'
      }
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

// Single-page fetch that respects limit/offset params — use when you don't want all rows.
// supaFetch auto-paginates and silently ignores any limit= in the query string.
async function supaFetchLimit(table, params = '') {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
    headers: { ...supaHeaders(), 'Prefer': 'count=none' }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Authenticated single-page fetch — sends the CURRENT USER'S access token
// instead of the anon key. supaFetch/supaFetchLimit above always read as
// the anon role, so they only ever see rows covered by a public/anon RLS
// policy. Use this instead for "my own rows" reads gated by an
// authenticated-only policy (e.g. submissions_select_own on `submissions`).
// Falls back to the anon key (returns whatever anon can see, usually
// nothing) if the user isn't signed in, so callers don't need to guard.
async function supaFetchOwn(table, params = '') {
  const token = currentUser?.access_token || SUPA_KEY;
  const doFetch = (tok) => fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
    headers: supaHeaders({ 'Authorization': `Bearer ${tok}`, 'Prefer': 'count=none' })
  });
  let res = await doFetch(token);
  if (res.status === 401 && currentUser?.refresh_token) {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch(currentUser.access_token);
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function supaInsert(table, data) {
  // All inserts (including submissions) go straight through the REST API.
  // Auth, ownership (user_id), sanitization, and rate-limiting for `submissions`
  // are enforced server-side by RLS policies + a BEFORE INSERT trigger —
  // no Edge Function involved, and no anonymous inserts are accepted.
  if (table === 'submissions' && !currentUser?.access_token) {
    // Fail fast client-side with a clear message before even hitting the API
    throw new Error('Please sign in to submit.');
  }

  const token = currentUser?.access_token || SUPA_KEY;
  const doFetch = (tok) => fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: supaHeaders({
      'Authorization': `Bearer ${tok}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }),
    body: JSON.stringify(data)
  });
  let res = await doFetch(token);
  // If the access token expired mid-session, try to refresh once and retry
  if (res.status === 401 && currentUser?.refresh_token) {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch(currentUser.access_token);
  }
  if (!res.ok) {
    const errText = await res.text();
    console.error('Supabase insert error:', res.status, errText);
    if (table === 'submissions') {
      let msg = errText;
      try { msg = JSON.parse(errText).message || errText; } catch(e) {}
      if (res.status === 401 || res.status === 403 || /row-level security/i.test(msg)) {
        throw new Error('Please sign in to submit.');
      }
      if (/Rate limit exceeded/i.test(msg)) {
        throw new Error('You have submitted too many times. Please wait an hour before trying again.');
      }
      throw new Error(msg || 'Submission failed, please try again');
    }
    throw new Error(errText);
  }
  return res.json();
}

// ── COUNT HELPER (Supabase server-side count, zero row transfer) ──
async function supaCount(table, params = '') {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}&select=id`, {
    headers: {
      ...supaHeaders({ 'Prefer': 'count=exact', 'Range': '0-0', 'Range-Unit': 'items' })
    }
  });
  if (!res.ok) throw new Error(await res.text());
  const contentRange = res.headers.get('Content-Range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}


// ─────────────────────────────────────────────────────────────
// JOBS — Adzuna API (powers "Poolside" on the Apps page)
// ─────────────────────────────────────────────────────────────
// Adzuna is a job-search aggregator — one query fans out across SEEK,
// Indeed, Jora and many other Australian/NZ job boards, so this single
// integration covers "many different platforms" without needing a
// separate key for each one.
//
// Get free keys (instant signup, generous free tier) at:
//   https://developer.adzuna.com/
//
// Paste them below. Like SUPA_KEY above, these are used directly from
// the browser — Adzuna's search endpoint supports CORS — so they will be
// visible in the page source. That's expected for a client-only app; just
// don't reuse an Adzuna key from a different, more sensitive project.
const ADZUNA_APP_ID  = 'YOUR_ADZUNA_APP_ID';
const ADZUNA_APP_KEY = 'YOUR_ADZUNA_APP_KEY';

function adzunaConfigured() {
  return !!(ADZUNA_APP_ID && ADZUNA_APP_KEY &&
    ADZUNA_APP_ID  !== 'YOUR_ADZUNA_APP_ID' &&
    ADZUNA_APP_KEY !== 'YOUR_ADZUNA_APP_KEY');
}

