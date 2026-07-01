// ╔═══════════════════════════════════════════════════════════╗
// ║  AUTH — Session, Login, Register, OAuth, Profile         ║
// ╚═══════════════════════════════════════════════════════════╝

let currentUser = null; // { id, email, name, access_token, refresh_token }

// ── SESSION ──
// Profile (non-sensitive) → localStorage so it survives restarts.
// Tokens (sensitive)      → sessionStorage so they clear on tab close.

function _saveSession(u) {
  try { localStorage.setItem('hive_profile', JSON.stringify({ id: u.id, email: u.email, name: u.name })); } catch(e) {}
  try { sessionStorage.setItem('hive_tokens', JSON.stringify({ access_token: u.access_token || null, refresh_token: u.refresh_token || null })); } catch(e) {}
}

function _clearSession() {
  ['hive_profile', 'hive_session'].forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
  try { sessionStorage.removeItem('hive_tokens'); } catch(e) {}
}

function _loadSession() {
  try {
    const profile = JSON.parse(localStorage.getItem('hive_profile') || 'null');
    const tokens  = JSON.parse(sessionStorage.getItem('hive_tokens') || 'null');
    const legacy  = JSON.parse(localStorage.getItem('hive_session') || 'null');
    if (profile && tokens) return { ...profile, ...tokens };
    return legacy || null;
  } catch(e) { return null; }
}

async function refreshSession() {
  const saved = _loadSession();
  if (!saved?.refresh_token) return false;
  try {
    const res  = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: saved.refresh_token })
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return false;
    currentUser = { ...saved, access_token: data.access_token, refresh_token: data.refresh_token || saved.refresh_token };
    _saveSession(currentUser);
    return true;
  } catch(e) { return false; }
}

// Restore session after DOM + all scripts are ready
document.addEventListener('DOMContentLoaded', function() {
  const saved = _loadSession();
  if (!saved) return;
  currentUser = saved;
  if (localStorage.getItem('hive_session')) { _saveSession(saved); localStorage.removeItem('hive_session'); }
  updateHeaderAuth();
  if (!saved.access_token) return;
  fetch(`${SUPA_URL}/auth/v1/user`, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${saved.access_token}` } })
    .then(async r => {
      if (!r.ok) {
        const ok = await refreshSession();
        if (!ok) { currentUser = null; _clearSession(); updateHeaderAuth(); }
      }
    })
    .catch(() => {}); // network error → keep session (offline-friendly)
});

// ── HEADER ──

function updateHeaderAuth() {
  const btn = document.getElementById('headerAuthBtn');
  if (!btn) return;
  if (currentUser) {
    btn.className = 'header-login-btn header-login-btn-user';
    btn.innerHTML = escHTML(getInitials(currentUser.name || currentUser.email));
    btn.setAttribute('aria-label', 'Your profile');
    btn.setAttribute('title', 'Your profile');
  } else {
    btn.className = 'header-login-btn';
    btn.innerHTML = '<i class="material-symbols-outlined">account_circle</i>';
    btn.setAttribute('aria-label', 'Sign in');
    btn.setAttribute('title', 'Sign in');
  }
}

function openAuthOrProfile() {
  if (currentUser) { renderProfilePage(); goToRaw('profile'); }
  else goToRaw('auth');
}

// Navigate to a page without updating the currentPage global (used for
// overlay-style pages like auth and profile that sit above the main nav).
function goToRaw(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  ['mainFab', 'communityFab'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  ['toggleFab', 'toggleFarmsFab', 'communityToggle'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('visible'); });
}

// ── AUTH FORMS ──

function switchAuthTab(tab) {
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('authPanelLogin').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('authPanelRegister').style.display = tab === 'register' ? '' : 'none';
}

function _setAuthUser(id, email, name, access_token, refresh_token) {
  currentUser = { id, email, name, access_token, refresh_token: refresh_token || null };
  _saveSession(currentUser);
  updateHeaderAuth();
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');
  if (!email || !pass) { errEl.textContent = 'Please fill in all fields'; errEl.classList.add('show'); return; }
  try {
    const res  = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
    _setAuthUser(data.user.id, data.user.email, data.user.user_metadata?.name || email.split('@')[0], data.access_token, data.refresh_token);
    // Return to the page the user was trying to reach before the sign-in gate
    const returnPage = typeof authGateReturnPage !== 'undefined' && authGateReturnPage ? authGateReturnPage : 'home';
    authGateReturnPage = null;
    goTo(returnPage);
    showToast('Welcome back, ' + currentUser.name + '! 🐝');
  } catch(e) { errEl.textContent = e.message; errEl.classList.add('show'); }
}

async function doRegister() {
  const name  = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const pass  = document.getElementById('registerPassword').value;
  const errEl = document.getElementById('registerError');
  errEl.classList.remove('show');
  if (!email || !pass) { errEl.textContent = 'Please fill in all fields'; errEl.classList.add('show'); return; }
  if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.classList.add('show'); return; }
  try {
    const res  = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, data: { name: name || email.split('@')[0] } })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Registration failed');
    _setAuthUser(data.user?.id || data.id, email, name || email.split('@')[0], data.access_token, data.refresh_token);
    const returnPage = typeof authGateReturnPage !== 'undefined' && authGateReturnPage ? authGateReturnPage : 'home';
    authGateReturnPage = null;
    goTo(returnPage);
    showToast('Welcome to the hive, ' + currentUser.name + '! 🐝');
  } catch(e) { errEl.textContent = e.message; errEl.classList.add('show'); }
}

function doGoogleLogin() {
  const redirectTo = encodeURIComponent(window.location.href.split('?')[0].split('#')[0]);
  window.location.href = `${SUPA_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}

function handleOAuthRedirect() {
  const hash = window.location.hash;
  if (!hash.includes('access_token')) return;
  const params       = new URLSearchParams(hash.substring(1));
  const token        = params.get('access_token');
  const refreshToken = params.get('refresh_token') || null;
  if (!token) return;
  fetch(`${SUPA_URL}/auth/v1/user`, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => {
      if (!data.id) return;
      _setAuthUser(data.id, data.email, data.user_metadata?.full_name || data.user_metadata?.name || data.email.split('@')[0], token, refreshToken);
      history.replaceState(null, '', window.location.pathname);
      showToast('Welcome, ' + currentUser.name + '! 🐝');
    })
    .catch(() => {});
}

function doLogout() {
  currentUser = null;
  _clearSession();
  updateHeaderAuth();
  goTo('home');
  showToast('Signed out');
}

// ── LOCAL PROFILE DRAFT ──
// Stored in localStorage until user_profiles table is wired up in Supabase.

function getLocalProfile() {
  try { return JSON.parse(localStorage.getItem('hive_profile_draft') || '{}'); } catch(e) { return {}; }
}
function saveLocalProfile(data) {
  try { localStorage.setItem('hive_profile_draft', JSON.stringify(data)); } catch(e) {}
}

const WHV_LABELS = {
  on_whv:  '🌏 On WHV',
  done_88: '✅ Done 88 days',
  looking: '🔍 Looking for farm',
  working: '🌾 Currently working',
  tourist: '🎒 Tourist',
  other:   'Other',
};

// ── PROFILE PAGE ──

function renderProfilePage() {
  const editBtn = document.getElementById('profileEditBtn');

  if (!currentUser) {
    if (editBtn) editBtn.style.display = 'none';
    document.getElementById('profileContent').innerHTML = `
      <div class="profile-sign-in-wall">
        <div class="profile-sign-in-icon">🐝</div>
        <div class="profile-sign-in-title">Join the Hive</div>
        <div class="profile-sign-in-sub">Sign in to track your contributions, write reviews, and connect with the backpacker community.</div>
        <button class="profile-sign-in-btn" onclick="goToRaw('auth')">Sign in or create account</button>
      </div>`;
    return;
  }

  if (editBtn) editBtn.style.display = 'flex';

  const draft  = getLocalProfile();
  const name   = escHTML(draft.display_name || currentUser.name);
  const bio    = draft.bio ? `<div style="font-size:13px;color:var(--text-mid);margin-top:6px;line-height:1.5;">${escHTML(draft.bio)}</div>` : '';
  const since  = new Date(currentUser.created_at || Date.now()).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const isDark = document.documentElement.classList.contains('dark');

  // Badges — build from an array so adding new ones is one line
  const badges = [
    draft.whv_status && WHV_LABELS[draft.whv_status] ? `<span class="profile-badge whv">${WHV_LABELS[draft.whv_status]}</span>` : '',
    draft.home_country     ? `<span class="profile-badge country"><i class="ti ti-globe"></i> ${escHTML(draft.home_country)}</span>`          : '',
    draft.current_location ? `<span class="profile-badge location"><i class="ti ti-map-pin"></i> ${escHTML(draft.current_location)}</span>`    : '',
  ].filter(Boolean).join('');

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-big">${escHTML(getInitials(draft.display_name || currentUser.name))}</div>
      <div class="profile-name">${name}</div>
      <div class="profile-email">${escHTML(currentUser.email)}</div>
      ${bio}
      <div class="profile-member-since" style="margin-top:${bio ? '8' : '4'}px;"><i class="ti ti-calendar"></i> Member since ${since}</div>
      ${badges ? `<div class="profile-badges">${badges}</div>` : ''}
    </div>

    <div class="profile-stats">
      <div class="profile-stat"><div class="profile-stat-num" id="ps-reviews">–</div><div class="profile-stat-label">Reviews</div></div>
      <div class="profile-stat"><div class="profile-stat-num" id="ps-posts">–</div><div class="profile-stat-label">Posts</div></div>
      <div class="profile-stat"><div class="profile-stat-num" id="ps-contribs">–</div><div class="profile-stat-label">Contributions</div></div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">My activity</div>
      <div class="profile-row" onclick="showToast('My contributions coming soon!')">
        <div class="profile-row-icon green"><i class="ti ti-map-pin"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">My contributions</div><div class="profile-row-sub">Farms, deals & prices you submitted</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="showToast('My reviews coming soon!')">
        <div class="profile-row-icon amber"><i class="ti ti-star"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">My reviews</div><div class="profile-row-sub">Farms you've rated</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="openMyActivity()">
        <div class="profile-row-icon blue"><i class="ti ti-messages"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Community posts</div><div class="profile-row-sub">Your posts, likes & replies</div></div>
        <i class="ti ti-chevron-right profile-row-arrow"></i>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Account</div>
      <div class="profile-row" onclick="showToast('Notifications coming soon!')">
        <div class="profile-row-icon amber"><i class="ti ti-bell"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Notifications</div><div class="profile-row-sub">Submission updates & replies</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="showToast('Saved farms coming soon!')">
        <div class="profile-row-icon pink"><i class="ti ti-bookmark"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Saved farms</div><div class="profile-row-sub">Your favourites</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="toggleTheme()">
        <div class="profile-row-icon gray"><i id="profileThemeIcon" class="ti ${isDark ? 'ti-sun' : 'ti-moon'}"></i></div>
        <div class="profile-row-body"><div class="profile-row-label" id="profileThemeLabel">${isDark ? 'White mode' : 'Dark mode'}</div></div>
        <i class="ti ti-chevron-right profile-row-arrow"></i>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Legal</div>
      <div class="profile-row" onclick="showToast('Terms of Service coming soon!')">
        <div class="profile-row-icon gray"><i class="ti ti-file-description"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Terms of Service</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="showToast('Privacy Policy coming soon!')">
        <div class="profile-row-icon gray"><i class="ti ti-lock"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Privacy Policy</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
      <div class="profile-row" onclick="showToast('Cookie settings coming soon!')">
        <div class="profile-row-icon gray"><i class="ti ti-cookie"></i></div>
        <div class="profile-row-body"><div class="profile-row-label">Cookie settings</div></div>
        <span class="profile-coming-soon">Soon</span>
      </div>
    </div>

    <button class="profile-logout-btn" onclick="doLogout()"><i class="ti ti-logout"></i> Sign out</button>
    <div style="height:40px;"></div>
  `;

  _myActivityLoaded = false;
  _myActivityTab = 'posts';
  _myActivityCat = 'all';
  loadProfileStats();
}

async function loadProfileStats() {
  if (!currentUser) return;
  const uid = currentUser.id;
  await Promise.all([
    { table: 'farm_reviews', id: 'ps-reviews'  },
    { table: 'forum_posts',  id: 'ps-posts'    },
    { table: 'submissions',  id: 'ps-contribs' },
  ].map(async ({ table, id }) => {
    const el = document.getElementById(id);
    if (!el) return;
    try { el.textContent = await supaCount(table, `user_id=eq.${uid}`); }
    catch(e) { el.textContent = '0'; }
  }));
}

// ── MY ACTIVITY ──

let _myActivityTab    = 'posts';
let _myActivityCat    = 'all';
let _myActivityData   = { posts: [], liked: [], replies: [] };
let _myActivityLoaded = false;

async function openMyActivity() {
  goToRaw('myactivity');
  buildMyActivityCatTabs();
  if (!_myActivityLoaded) await loadMyActivity();
  else renderMyActivityList();
}

function buildMyActivityCatTabs() {
  const container = document.getElementById('myActivityCatTabs');
  if (!container) return;
  // All + each forum category in one unified array
  container.innerHTML = [{ key: 'all', label: 'All' }, ...FORUM_CATEGORIES]
    .map(c => `<button class="forum-tab ${_myActivityCat === c.key ? 'active' : ''}" data-acat="${c.key}" onclick="switchMyActivityCat(this)">${c.label}</button>`)
    .join('');
}

async function loadMyActivity() {
  renderMyActivityList('<div class="map-loading"><div class="spinner"></div>Loading…</div>');
  try {
    const [posts, replies] = await Promise.all([
      currentUser ? supaFetch('forum_posts',   `user_id=eq.${currentUser.id}&order=created_at.desc`) : [],
      currentUser ? supaFetch('forum_replies', `user_id=eq.${currentUser.id}&order=created_at.desc`) : [],
    ]);
    const likedIds = [...getLikedSet('hive_liked_posts')];
    const liked    = likedIds.length ? await supaFetch('forum_posts', `id=in.(${likedIds.join(',')})&order=created_at.desc`) : [];
    _myActivityData   = { posts, liked, replies };
    _myActivityLoaded = true;
  } catch(e) {
    _myActivityData = { posts: [], liked: [], replies: [] };
    logError('loadMyActivity', e);
  }
  renderMyActivityList();
}

// Shared tab-switcher: deactivates siblings, activates clicked btn, re-renders
function _switchTab(scopeSelector, btn, stateKey, dataAttr) {
  document.querySelectorAll(`${scopeSelector} .forum-tab`).forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (stateKey === 'tab') _myActivityTab = btn.dataset[dataAttr];
  if (stateKey === 'cat') _myActivityCat = btn.dataset[dataAttr];
  renderMyActivityList();
}

function switchMyActivityTab(btn) { _switchTab('#myActivityTabs',    btn, 'tab', 'act');  }
function switchMyActivityCat(btn) { _switchTab('#myActivityCatTabs', btn, 'cat', 'acat'); }

function renderMyActivityList(overrideHtml) {
  const el = document.getElementById('myActivityList');
  if (!el) return;
  if (overrideHtml) { el.innerHTML = overrideHtml; return; }

  const catColors    = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.cssClass]));
  const catLabels    = Object.fromEntries(FORUM_CATEGORIES.map(c => [c.key, c.shortLabel]));
  const avatarColors = ['fa-amber', 'fa-green', 'fa-blue', 'fa-pink'];
  const empty        = msg => `<div class="no-posts" style="padding:28px 20px;text-align:center;color:var(--text-light);font-size:14px;">${msg}</div>`;

  if (_myActivityTab === 'replies') {
    const replies = _myActivityData.replies;
    if (!replies.length) { el.innerHTML = empty('No replies yet.'); return; }
    el.innerHTML = replies.map(r => `
      <div class="forum-post" style="cursor:default;">
        <div class="forum-post-header">
          <div class="forum-avatar fa-amber" style="width:32px;height:32px;font-size:13px;">${escHTML(getInitials(currentUser?.name || 'Me'))}</div>
          <div class="fp-meta"><div class="fp-author">You replied</div><div class="fp-time">${formatTimeAgo(r.created_at)}</div></div>
        </div>
        <p class="fp-preview" style="-webkit-line-clamp:3;">${escHTML(r.content)}</p>
        <div class="fp-footer">
          <span class="fp-stat"><i class="ti ti-heart"></i> ${r.likes || 0}</span>
          <button class="post-action" style="margin-left:auto;font-size:12px;color:var(--amber-dark);font-weight:600;" onclick="openPost('${r.post_id}')">View post <i class="ti ti-arrow-right"></i></button>
        </div>
      </div>`).join('') + '<div style="height:20px;"></div>';
    return;
  }

  let items = _myActivityTab === 'liked' ? _myActivityData.liked : _myActivityData.posts;
  if (_myActivityCat !== 'all') items = items.filter(p => p.category === _myActivityCat);
  if (!items.length) { el.innerHTML = empty(_myActivityTab === 'liked' ? 'No liked posts yet.' : "You haven't posted yet."); return; }

  el.innerHTML = items.map(p => {
    const colorIdx = (p.author_name || 'A').charCodeAt(0) % avatarColors.length;
    const safeId   = encodeURIComponent(p.id);
    return `<div class="forum-post" onclick="openPost(decodeURIComponent('${safeId}'))">
      <div class="forum-post-header">
        <div class="forum-avatar ${avatarColors[colorIdx]}" style="width:32px;height:32px;font-size:13px;">${escHTML(getInitials(p.author_name))}</div>
        <div class="fp-meta"><div class="fp-author">${escHTML(p.author_name || 'Anonymous')}</div><div class="fp-time">${formatTimeAgo(p.created_at)}</div></div>
        <span class="fp-category ${catColors[p.category] || 'fp-cat-general'}">${catLabels[p.category] || 'Post'}</span>
      </div>
      <div class="fp-title">${escHTML(p.title)}</div>
      <p class="fp-preview">${escHTML(p.content)}</p>
      <div class="fp-footer"><span class="fp-stat"><i class="ti ti-heart"></i> ${p.likes || 0}</span></div>
    </div>`;
  }).join('') + '<div style="height:20px;"></div>';
}

// ── PROFILE EDIT ──

let _editingWhv = null;

// Field map: [elementId, draftKey, fallback]
const _EDIT_FIELDS = [
  ['editDisplayName',     'display_name',     () => currentUser?.name || ''],
  ['editBio',             'bio',              () => ''],
  ['editHomeCountry',     'home_country',     () => ''],
  ['editCurrentLocation', 'current_location', () => ''],
];

function openProfileEdit() {
  const draft = getLocalProfile();
  _EDIT_FIELDS.forEach(([id, key, fallback]) => {
    document.getElementById(id).value = draft[key] || fallback();
  });
  _editingWhv = draft.whv_status || null;
  document.querySelectorAll('.whv-option').forEach(btn => btn.classList.toggle('selected', btn.dataset.whv === _editingWhv));
  document.getElementById('profileEditOverlay').classList.add('open');
}

function closeProfileEdit() {
  document.getElementById('profileEditOverlay').classList.remove('open');
}

function selectWhvOption(btn) {
  document.querySelectorAll('.whv-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _editingWhv = btn.dataset.whv;
}

function saveProfileEdit() {
  const saveBtn = document.getElementById('profileEditSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const draft = Object.fromEntries(
    _EDIT_FIELDS.map(([id, key, fallback]) => [key, document.getElementById(id).value.trim() || fallback()])
  );
  draft.whv_status = _editingWhv || null;

  saveLocalProfile(draft);
  if (draft.display_name && currentUser) { currentUser.name = draft.display_name; _saveSession(currentUser); }

  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ti ti-check"></i> Save changes';
    closeProfileEdit();
    renderProfilePage();
    showToast('Profile updated! 🐝');
  }, 300);
}
