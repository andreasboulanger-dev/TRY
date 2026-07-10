// ╔═══════════════════════════════════════════════════════════╗
// ║  NAVIGATION — goTo, View Toggles, Slider                 ║
// ╚═══════════════════════════════════════════════════════════╝

// ── MAP LEGEND DRAWER ──
// One shared drawer, reused across the farms / deals / forum map pages.
// Colors/emoji below are copied directly from the pin builders in
// farms.js (farmColors/farmEmoji), deals.js (dealColor/dealEmoji), and
// community.js (ACT_COLORS/ACT_ICONS) — keep these in sync if those change.
const LEGEND_DATA = {
  farms: {
    title: 'Farms Map Legend',
    items: [
      { color:'#2E7D32', emoji:'🍎', label:'Fruits & Orchards' },
      { color:'#6D4C41', emoji:'🐄', label:'Livestock' },
      { color:'#388E3C', emoji:'🌱', label:'Plants & Nursery' },
      { color:'#4527A0', emoji:'🍇', label:'Vineyard & Winery' },
      { color:'#00796B', emoji:'🥦', label:'Vegetables & Crops' },
      { color:'#F9A825', emoji:'🍯', label:'Honey' },
      { color:'#EF6C00', emoji:'🐔', label:'Poultry & Eggs' },
      { color:'#0277BD', emoji:'🥛', label:'Dairy' },
      { color:'#00838F', emoji:'🦐', label:'Aquaculture' },
      { color:'#558B2F', emoji:'🚜', label:'Mixed & Specialty' },
      { color:'#78909C', emoji:'🌾', label:'Other' },
      { color:'var(--md-sys-color-secondary)', text:'12', label:'Cluster', sub:'Multiple farms grouped — tap to zoom in' },
      { color:'#185FA5', text:'✓', label:'Verified', sub:'ID verified by The Hive' },
      { color:'#F5A623', text:'●', label:'Your location' },
    ],
  },
  deals: {
    title: 'Local Prices & Deals Legend',
    items: [
      { color:'#D84315', emoji:'🍺', label:'Bar' },
      { color:'#795548', emoji:'☕', label:'Café' },
      { color:'#00796B', emoji:'🏷️', label:'Deal' },
      { color:'#6A1B9A', emoji:'🏄', label:'Activity' },
      { color:'#1565C0', emoji:'🛏️', label:'Hostel' },
      { color:'#F5A623', text:'●', label:'Your location' },
    ],
    footer: 'Pins with a price tag attached show the lowest current price at that business, and update automatically when a happy hour or local discount kicks in.',
  },
  forum: {
    title: 'Community Map Legend',
    items: [
      { color:'#3B6D11', emoji:'🥾', label:'Outdoor' },
      { color:'#D4851A', emoji:'⚽', label:'Sport' },
      { color:'#6B3FA0', emoji:'🌙', label:'Nightlife' },
      { color:'#C0392B', emoji:'🍻', label:'Food' },
      { color:'#185FA5', emoji:'👥', label:'Social' },
      { color:'#2E7D32', emoji:'🚗', label:'Rideshare' },
      { color:'#E65100', emoji:'🎬', label:'Entertainment' },
      { color:'#00695C', emoji:'📷', label:'Sightseeing' },
      { color:'#AD1457', emoji:'🛍️', label:'Shopping' },
      { color:'#5C5750', emoji:'🧘', label:'Wellness' },
      { color:'#F5A623', text:'●', label:'Your location' },
    ],
  },
};

function openMapLegend(page) {
  const data = LEGEND_DATA[page];
  if (!data) return;
  document.getElementById('legendTitle').textContent = data.title;
  const rows = data.items.map(it => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${it.color}">${it.text || it.emoji || ''}</span>
      <div class="legend-row-body">
        <div class="legend-row-label">${it.label}</div>
        ${it.sub ? `<div class="legend-row-sub">${it.sub}</div>` : ''}
      </div>
    </div>`).join('');
  const footer = data.footer ? `<div class="legend-row-sub" style="padding:14px 4px 0;">${data.footer}</div>` : '';

  // Map tile attribution ("Leaflet | © OpenStreetMap contributors © CARTO", etc.) —
  // mirrored from the same map's Leaflet attribution control so credit stays
  // visible here too, in a spot that isn't fighting for space with the nav.
  const mapForPage = { farms: farmMap, deals: dealMap, forum: communityMap }[page];
  const attrHTML = mapForPage?.attributionControl?.getContainer()?.innerHTML;
  const attribution = attrHTML ? `<div class="legend-attribution">${attrHTML}</div>` : '';

  document.getElementById('legendBody').innerHTML = rows + footer + attribution;
  document.getElementById('legendOverlay').classList.add('open');
  document.getElementById('legendSheet').classList.add('open');
}

function closeMapLegend() {
  document.getElementById('legendOverlay').classList.remove('open');
  document.getElementById('legendSheet').classList.remove('open');
}

// ── NAV ──
// Material Symbols: icon glyph text never changes between active/inactive.
// The "filled" look for the active nav item is handled purely by CSS
// (.nav-item.active .material-symbols-outlined sets FILL:1) — no class
// swapping needed here.

// ── ADAPTIVE MID NAV SLOT ──
// Home (1st) and Apps (last) are the only two tabs that are always on the
// bar. Farms/Discounts/Community share a single slot between them, and only
// ever show the ONE the user is currently on — there's no pinning or
// rotation to track anymore, it's just "whatever page is active right now,
// if it's one of these three". Navigating to Home or Apps clears the slot.
// The other two of the three always live on the Apps page as quick-action
// cards (see renderNavOverflow) so they're never unreachable.
const MID_PAGES = {
  farms: { page: 'farms', navId: 'nav-farms', qaIcon: 'farms',     icon: 'potted_plant', name: 'Farm Directory', sub: 'Aus & NZ map' },
  deals: { page: 'deals', navId: 'nav-deals', qaIcon: 'deals',     icon: 'sell',         name: 'Discounts',       sub: 'Deals & local costs' },
  forum: { page: 'forum', navId: 'nav-forum', qaIcon: 'community', icon: 'diversity_3',  name: 'Community',       sub: 'Tips, stories & help' },
};

let midPage = null; // 'farms' | 'deals' | 'forum' | null — null means no mid slot showing (Home/Apps)

// STATE ONLY — decides whether the new page should occupy the mid slot
// (farms/deals/forum) or clear it (home/apps). Returns true if it changed.
// Does not touch the DOM; call updateResponsiveNav() afterwards to render it.
function activateMidPage(page) {
  const nextMid = MID_PAGES[page] ? page : null;
  if (midPage === nextMid) return false;
  midPage = nextMid;
  return true;
}

// DOM ONLY — shows the current midPage's button (if any) in its slot before
// Apps, hides the other two, and keeps the Apps-page quick-action cards
// (all three, always) in sync. Purely reads midPage; never changes it.
function renderMidNav() {
  const nav     = document.querySelector('.bottom-nav');
  const appsBtn = document.getElementById('nav-apps');
  if (!nav || !appsBtn) return;

  Object.keys(MID_PAGES).forEach(p => {
    const btn = document.getElementById(MID_PAGES[p].navId);
    if (!btn) return;
    if (p === midPage) {
      btn.style.display = '';
      nav.insertBefore(btn, appsBtn);
    } else {
      btn.style.display = 'none';
    }
  });
}

// Fades + scales a nav button in from the middle — used when a page newly
// takes over the mid slot, so it doesn't just pop into place.
function playNavSwapIn(navId) {
  const btn = document.getElementById(navId);
  if (!btn) return;
  btn.classList.remove('nav-swap-in');
  void btn.offsetWidth; // restart the animation even if it's mid-play
  btn.classList.add('nav-swap-in');
  btn.addEventListener('animationend', () => btn.classList.remove('nav-swap-in'), { once: true });
}

// Applies the "active" state to the correct nav button. Normally that's
// just nav-<currentPage> — except when currentPage is farms/deals/forum but
// there wasn't room to show it in the bar (see updateResponsiveNav's last
// resort below): in that case Apps stands in as the active tab, since
// that's the only remaining place that page is reachable from.
function updateActiveNavItem() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  let activeId = 'nav-' + currentPage;
  if (MID_PAGES[currentPage]) {
    const btn = document.getElementById(MID_PAGES[currentPage].navId);
    const midOnBar = !!(btn && btn.style.display !== 'none');
    activeId = midOnBar ? MID_PAGES[currentPage].navId : 'nav-apps';
  }

  const navEl = document.getElementById(activeId);
  if (navEl) navEl.classList.add('active');
}


// The bar's width is CSS `fit-content` (see .bottom-nav), which browsers
// can't smoothly transition to/from directly — the box just snaps to its
// new size the instant a tab appears/disappears, so the CSS `transition:
// width` never gets two real values to interpolate between. This does it
// manually (the classic FLIP technique): measure the width before, run the
// DOM change, measure the width after, then animate old-px -> new-px. Once
// the transition ends, the inline width is cleared so `fit-content` stays
// in control for any layout changes that happen outside this helper (e.g.
// a plain window resize).
let _cancelNavWidthAnimation = null; // cleanup for any in-flight animation, so a new call can cancel it cleanly

function animateNavWidthChange(fn) {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) { fn(); return; }

  _cancelNavWidthAnimation?.();
  _cancelNavWidthAnimation = null;

  const before = nav.getBoundingClientRect().width; // current visual width — the FLIP start point

  // Clear any locked inline width before measuring/deciding: fn() (which
  // runs the compact-stage logic below) needs the bar's true natural size,
  // not whatever px value happened to be left over from the last call.
  nav.style.width = '';
  fn();
  const after = nav.getBoundingClientRect().width; // true natural width after fn()'s DOM changes

  if (Math.abs(after - before) < 0.5) {
    nav.style.width = ''; // nothing changed — don't leave a stale px lock
    return;
  }

  // .bottom-nav is `overflow: visible` normally (badges/tooltips rely on
  // that), but while the bar is LOCKED at the smaller "before" width, any
  // newly-inserted tab already sits fully expanded outside that box — with
  // overflow visible, it pokes out past the rounded pill edge for the
  // whole growth animation instead of being revealed as the bar grows
  // around it. Clip it for just this animation, then hand overflow back.
  nav.style.overflow = 'hidden';
  nav.style.width = before + 'px';
  nav.getBoundingClientRect(); // force a reflow so the browser registers the start value before animating
  requestAnimationFrame(() => { nav.style.width = after + 'px'; });

  // transitionend BUBBLES from every child that finishes its own transition
  // (a nav-label's opacity, a nav-pill's padding/background, etc.), so this
  // has to confirm it's the bar's OWN width transition finishing — reacting
  // to the first bubbled event of any kind would clear (or fail to clear)
  // the lock at the wrong time.
  const onTransitionEnd = (e) => {
    if (e.target === nav && e.propertyName === 'width') cleanup();
  };
  const cleanup = () => {
    nav.style.width = '';
    nav.style.overflow = '';
    nav.removeEventListener('transitionend', onTransitionEnd);
    _cancelNavWidthAnimation = null;
  };
  nav.addEventListener('transitionend', onTransitionEnd);
  _cancelNavWidthAnimation = cleanup;
}

function goTo(page) {
  closePinCard();
  currentPage = page;

  // .page is always in the DOM (position:absolute, not display:none) and
  // .page/.page.active already carries an opacity+transform transition (see
  // styles.css), so a plain class swap crossfades on its own — no JS-driven
  // animation needed here.
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  const midChanged = activateMidPage(page);        // state only
  animateNavWidthChange(updateResponsiveNav);       // renders it (once), animated, + settles the active tab
  if (midChanged && midPage) playNavSwapIn(MID_PAGES[midPage].navId);

  updateAttributionVisibility();

  const tf      = document.getElementById('toggleFab');
  const tfFarms = document.getElementById('toggleFarmsFab');

  if (page === 'deals') {
    tf.classList.add('visible');
    tfFarms.classList.remove('visible');
    document.getElementById('mainFab').style.display = '';
    showSlider(true);
    if (!dealsLoaded) initDealMap();
    startPriceRefresh();
  } else if (page === 'farms') {
    tf.classList.remove('visible');
    tfFarms.classList.add('visible');
    document.getElementById('mainFab').style.display = '';
    showSlider(false);
    stopPriceRefresh();
    if (!farmMap) initFarmMap();
  } else if (page === 'home' || page === 'apps') {
    tf.classList.remove('visible');
    tfFarms.classList.remove('visible');
    document.getElementById('mainFab').style.display = '';
    showSlider(false);
    stopPriceRefresh();
  } else {
    tf.classList.remove('visible');
    tfFarms.classList.remove('visible');
    document.getElementById('mainFab').style.display = 'none';
    showSlider(false);
    stopPriceRefresh();
  }
  // Community FAB + toggle
  const communityFab = document.getElementById('communityFab');
  const communityToggle = document.getElementById('communityToggle');
  if (page === 'forum') {
    communityFab.style.display = 'flex';
    communityToggle.style.display = 'flex';
    loadForumPosts();
    if (!communityMap) initCommunityMap();
  } else {
    communityFab.style.display = 'none';
    communityToggle.style.display = 'none';
  }
}

// ── DEALS TOGGLE ──
// ── Shared map/list toggle helper ──
// Swaps between map-view and list-view for a given page.
// cfg.mapEl / cfg.listEl  — the two DOM elements to swap
// cfg.iconEl / cfg.labelEl — the FAB icon and label to update
// cfg.modeRef             — { value: 'map'|'list' } mutable ref
// cfg.onList / cfg.onMap  — callbacks invoked after each switch
function _toggleMapListView({ mapEl, listEl, iconEl, labelEl, modeRef, onList, onMap }) {
  if (modeRef.value === 'map') {
    modeRef.value = 'list';
    mapEl.classList.remove('active'); mapEl.style.display = 'none';
    listEl.classList.add('active');
    iconEl.className = 'material-symbols-outlined'; iconEl.textContent = 'map'; labelEl.textContent = 'Map';
    onList?.();
  } else {
    modeRef.value = 'map';
    listEl.classList.remove('active');
    mapEl.style.display = ''; mapEl.classList.add('active');
    iconEl.className = 'material-symbols-outlined'; iconEl.textContent = 'list'; labelEl.textContent = 'List';
    onMap?.();
  }
}

function toggleDealsView() {
  _toggleMapListView({
    mapEl:   document.getElementById('dealsMapView'),
    listEl:  document.getElementById('dealsListView'),
    iconEl:  document.getElementById('toggleIcon'),
    labelEl: document.getElementById('toggleLabel'),
    modeRef: _dealViewMode,
    onList:  () => { showSlider(false); renderDealsList(currentFilteredDeals.length ? currentFilteredDeals : allDeals); },
    onMap:   () => { showSlider(true); if (dealMap) setTimeout(() => dealMap.invalidateSize(), 50); },
  });
  dealsViewMode = _dealViewMode.value; // keep legacy var in sync
}

// ── SLIDER ──
function showSlider(visible) {
  document.getElementById('priceSliderBar').classList.toggle('visible', visible);
  ['bugFab', 'toggleFab'].forEach(id => {
    document.getElementById(id)?.classList.toggle('raised', visible);
  });
}

function initSlider(prices) {
  const rawMax = Math.max(5, ...prices.map(p => parseFloat(p.price_normal || 0) || 0));
  sliderMax = Math.ceil(rawMax / 5) * 5;

  const input = document.getElementById('priceRangeInput');
  input.max   = sliderMax;
  input.value = sliderMax;

  // Update fill background
  updateSliderFill(input);

  input.oninput = function() {
    updateSliderFill(this);
    showBubble(this);
    filterPrices(parseInt(this.value));
  };
  input.onchange = function() {
    hideBubble();
  };

  // Show bubble while touching
  input.addEventListener('touchstart', () => showBubble(input), {passive:true});
  input.addEventListener('touchend',   () => setTimeout(hideBubble, 1200));
  input.addEventListener('pointerdown',() => showBubble(input));
  input.addEventListener('pointerup',  () => setTimeout(hideBubble, 1200));
}

function updateSliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.background = `linear-gradient(to right, var(--amber) ${pct}%, rgba(0,0,0,0.14) ${pct}%)`;
}

function showBubble(input) {
  const bubble = document.getElementById('sliderBubble');
  const val    = parseInt(input.value);
  bubble.textContent = val >= sliderMax ? 'Max' : '$' + val;

  // Position bubble above thumb, anchored to #app
  const pct    = (val - input.min) / (input.max - input.min);
  const trackW = input.clientWidth;
  const thumbW = 28;
  const thumbOffset = thumbW / 2 + pct * (trackW - thumbW);
  const inputRect = input.getBoundingClientRect();
  const appRect   = document.getElementById('app').getBoundingClientRect();
  const thumbX = inputRect.left - appRect.left + thumbOffset;
  const thumbY = inputRect.top  - appRect.top;
  bubble.style.left = thumbX + 'px';
  bubble.style.top  = (thumbY - 46) + 'px';
  bubble.style.transform = 'translateX(-50%)';
  bubble.classList.add('show');
}

function hideBubble() {
  document.getElementById('sliderBubble').classList.remove('show');
}

function filterPrices(maxVal) {
  const types = [..._activeDealTypes];
  const isAll = _activeDealTypes.has('all');
  const singleType = (!isAll && types.length === 1) ? types[0] : null;
  const filtered = _allPricesMaster.filter(p => {
    const pCat = normalizePriceCat(p.item_category_first);
    const matchCat = isAll || types.some(t => pCat === t);
    const price = parseFloat(p.price_normal || 0) || 0;
    const matchItem = !currentSubFilter.length || currentSubFilter.includes((p.item_name||'').trim());
    return price <= maxVal && matchCat && matchItem;
  });
  renderPricesFiltered(filtered, maxVal);

  const filteredDeals = _activeDealTypes.has('all') ? allDeals : allDeals.filter(d => {
    const bt = (d.business_type||'').toLowerCase();
    return types.some(t => bt.includes(t));
  });
  renderDealMarkers(filteredDeals, singleType || 'all', filtered);
}



// ── LIFT MAP ATTRIBUTION ABOVE THE NAV BLUR ──
// Each Leaflet map's container has its own z-index, so it forms its own
// stacking context — the attribution control trapped inside it can never
// out-rank the blur scrim no matter what z-index it's given. The fix is to
// detach it from the map and re-append it as a direct child of #app, which
// puts it in the same stacking context as the scrim/nav and lets its own
// z-index (see .map-attribution-lifted) take effect.
//
// Because it becomes a direct child of #app (not of any single .page), it
// would otherwise stay visible on every page forever, including Home,
// once any map has been opened once this session. `page` records which
// page the attribution belongs to, and updateAttributionVisibility() hides
// it again whenever a different page (like Home) becomes active.
function liftMapAttribution(map, page) {
  const el = map?.attributionControl?.getContainer?.();
  if (!el) return;
  if (!el.classList.contains('map-attribution-lifted')) {
    el.classList.add('map-attribution-lifted');
    document.getElementById('app')?.appendChild(el);
  }
  if (page) el.dataset.attrPage = page;
  updateAttributionVisibility();
}

function updateAttributionVisibility() {
  document.querySelectorAll('.map-attribution-lifted').forEach(el => {
    el.classList.toggle('attr-hidden', el.dataset.attrPage !== currentPage);
  });
}

// Phase 13: Scroll-driven header elevation (M3 Top App Bar — elevation 0 → 2 on scroll)
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.page').forEach(page => {
    page.addEventListener('scroll', () => {
      document.querySelector('.app-header').classList.toggle('scrolled', page.scrollTop > 4);
    }, { passive: true });
  });
});

// ── EXTRA-NARROW FALLBACK ──
// Home and Apps are permanently pinned and never get dropped. Farms/Deals/
// Forum only ever occupy a single mid slot between them, and only when
// there's room. The bar itself shrink-wraps to whatever's visible (see
// .bottom-nav / .nav-item in styles.css) up to a max-width capped by the
// FAB's clearance, so "too narrow" just means that cap is being exceeded.
// Each call re-measures from a fully shown, full-width state, then backs
// off through these stages — re-checking after each — until it fits, so
// tabs (and labels) come back the moment there's room again. Home + Apps
// are guaranteed to always fit; the mid slot (Farms/Deals/Forum) is the
// only thing that ever gets shrunk or dropped, so the bar always shows
// either 2 tabs (Home + Apps) or 3 (Home + mid + Apps) — never fewer.
const NAV_COMPACT_STAGES = [
  { className: 'nav-mid-compact', appliesIf: () => !!midPage }, // icon-only just the mid slot
  { className: 'nav-compact',     appliesIf: () => true },      // icon-only every tab
];

function _navTooNarrow(nav) {
  return nav.scrollWidth > nav.clientWidth + 1;
}

function updateResponsiveNav() {
  renderMidNav(); // fully re-show the mid slot (if any) at full width first

  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  // Always re-measure from the full-width state, then escalate one stage
  // at a time — re-checking after each — until it fits.
  nav.classList.remove(...NAV_COMPACT_STAGES.map(s => s.className));
  for (const stage of NAV_COMPACT_STAGES) {
    if (!_navTooNarrow(nav)) break;
    if (stage.appliesIf()) nav.classList.add(stage.className);
  }

  // Last resort: still too narrow even icon-only — drop the mid slot
  // entirely. Only Home and Apps remain; the current page becomes reachable
  // only via the Apps quick-action cards, so Apps stands in as the active
  // tab (see updateActiveNavItem).
  if (_navTooNarrow(nav) && midPage) {
    const btn = document.getElementById(MID_PAGES[midPage].navId);
    if (btn) btn.style.display = 'none';
  }

  renderNavOverflow();
  updateActiveNavItem();
}

// Always renders all 3 sections (Farms/Discounts/Community) as quick-action
// cards on the Apps page. Whichever one is currently sitting in the bottom
// nav's mid slot is shown filled-but-disabled (M3 style) since it's already
// reachable from the bar; the rest stay tappable.
function renderNavOverflow() {
  const actions = document.getElementById('navOverflowActions');
  if (!actions) return;

  const midBtn   = midPage ? document.getElementById(MID_PAGES[midPage].navId) : null;
  const midOnBar = !!(midBtn && midBtn.style.display !== 'none');

  actions.innerHTML = Object.keys(MID_PAGES).map(p => {
    const c = MID_PAGES[p];
    const disabled = midOnBar && p === midPage;
    return `
    <div class="qa-card${disabled ? ' qa-disabled' : ''}"${disabled ? '' : ` onclick="goTo('${c.page}')"`}>
      <div class="qa-icon ${c.qaIcon}"><i class="material-symbols-outlined">${c.icon}</i></div>
      <div><div class="qa-name">${escHTML(c.name)}</div><div class="qa-sub">${disabled ? 'Already in your nav bar' : escHTML(c.sub)}</div></div>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', updateResponsiveNav);

let _navResizeRaf = null;
window.addEventListener('resize', () => {
  cancelAnimationFrame(_navResizeRaf);
  _navResizeRaf = requestAnimationFrame(updateResponsiveNav);
});

