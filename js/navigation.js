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

// ── ADAPTIVE MID NAV SLOTS ──
// Home (1st) and Apps (last) are pinned at the far ends. Farms is pinned to
// the 2nd slot and never moves. Discounts and Community share the 3rd
// slot — only one of them is visible at a time. The other lives inside
// the Apps page as a quick-action card until the user opens it from there.
//
// midSlots[0] is always 'farms'. midSlots[1] is the 3rd nav button, and
// holds whichever of Discounts/Community is currently visible.
const MID_PAGES = {
  farms: { page: 'farms', navId: 'nav-farms', qaIcon: 'farms',     icon: 'potted_plant', name: 'Farm Directory', sub: 'Aus & NZ map' },
  deals: { page: 'deals', navId: 'nav-deals', qaIcon: 'deals',     icon: 'sell',         name: 'Discounts',       sub: 'Deals & local costs' },
  forum: { page: 'forum', navId: 'nav-forum', qaIcon: 'community', icon: 'diversity_3',  name: 'Community',       sub: 'Tips, stories & help' },
};

let midSlots = ['farms', 'deals']; // Farms is pinned here; Community starts tucked into Apps

// Rebuild the DOM order/visibility of the mid buttons from midSlots, and
// render whichever page is left out as a quick-action card on the Apps page.
function renderMidNav() {
  const nav     = document.querySelector('.bottom-nav');
  const appsBtn = document.getElementById('nav-apps');
  if (!nav || !appsBtn) return;

  midSlots.forEach(page => {
    const btn = document.getElementById(MID_PAGES[page].navId);
    if (!btn) return;
    btn.style.display = '';
    nav.insertBefore(btn, appsBtn);
  });

  const hiddenPage = Object.keys(MID_PAGES).find(p => !midSlots.includes(p));
  if (hiddenPage) {
    const btn = document.getElementById(MID_PAGES[hiddenPage].navId);
    if (btn) btn.style.display = 'none';
  }

  renderNavOverflow(hiddenPage ? [MID_PAGES[hiddenPage]] : []);
}

// Call whenever the user navigates to farms/deals/forum.
// Farms is permanently pinned to the 2nd slot and never moves. Only the
// 3rd slot rotates between Discounts and Community:
// - Navigating to whichever of those is already visible does nothing.
// - Navigating to the hidden one (only reachable via the Apps quick-action
//   card) swaps it into the 3rd slot, bumping whatever was there out to Apps.
function activateMidPage(page) {
  if (!MID_PAGES[page] || page === 'farms') return;
  if (midSlots[1] !== page) {
    midSlots = [midSlots[0], page];
    renderMidNav();

    // Play the swap-in animation on the tab that just became visible.
    const btn = document.getElementById(MID_PAGES[page].navId);
    if (btn) {
      btn.classList.remove('nav-swap-in');
      void btn.offsetWidth; // restart the animation even if it's mid-play
      btn.classList.add('nav-swap-in');
      btn.addEventListener('animationend', () => btn.classList.remove('nav-swap-in'), { once: true });
    }
  }
}

function goTo(page) {
  closePinCard();
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  activateMidPage(page);
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
    const matchItem = !currentSubFilter || (p.item_name||'').trim() === currentSubFilter;
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
// The adaptive mid-slot system above always keeps exactly 4 tabs visible
// (Home, Farms, 1 rotating page, Apps) and 1 tucked into Apps. On very
// narrow screens even 4 tabs can feel cramped, so as a last resort we also
// drop the 3rd slot — leaving just Home + Farms + Apps — and both
// Discounts and Community show up as quick-action cards on the Apps page.
//
// GUARD: Home, Farms, and Apps are permanently pinned and never get
// dropped. If the bar still doesn't fit with just those 3 (e.g. the active
// tab's expanded label pushes it over), updateResponsiveNav() adds a
// `.nav-compact` class that forces every tab — including the active one —
// to stay icon-only, so those 3 tabs always have room.
//
// Everything here is re-measured from a fully shown bar every time, so
// tabs (and labels) come back the moment there's room again.
const NAV_MIN_ITEM_WIDTH = 60; // px — a visible tab narrower than this counts as "too cramped"

function _navIsCramped(nav) {
  if (nav.scrollWidth > nav.clientWidth + 1) return true; // literally overflowing
  return midSlots.some(page => {
    const btn = document.getElementById(MID_PAGES[page].navId);
    return btn && btn.style.display !== 'none' && btn.offsetWidth > 0 && btn.offsetWidth < NAV_MIN_ITEM_WIDTH;
  });
}

function updateResponsiveNav() {
  renderMidNav(); // fully re-show the normal 2 mid slots first

  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  nav.classList.remove('nav-compact'); // always re-measure from full-width state

  if (!_navIsCramped(nav)) return;

  // Still cramped even with just 2 mid tabs — drop the 3rd-slot one too.
  const extra = MID_PAGES[midSlots[1]];
  const btn = document.getElementById(extra.navId);
  if (btn) btn.style.display = 'none';

  const hiddenPage = Object.keys(MID_PAGES).find(p => !midSlots.includes(p));
  renderNavOverflow([extra, MID_PAGES[hiddenPage]]);

  // GUARD: Home, Farms, and Apps are all pinned and can't be dropped — if
  // the bar still doesn't fit with just those 3, the last thing left to
  // shrink is the active tab's label. Force icon-only mode so the 3
  // permanent tabs always have room, no matter how narrow the screen gets.
  if (nav.scrollWidth > nav.clientWidth + 1) {
    nav.classList.add('nav-compact');
  }
}

function renderNavOverflow(items) {
  const title   = document.getElementById('navOverflowTitle');
  const actions = document.getElementById('navOverflowActions');
  if (!title || !actions) return;

  if (!items.length) {
    title.style.display = 'none';
    actions.style.display = 'none';
    actions.innerHTML = '';
    return;
  }

  title.style.display = '';
  actions.style.display = '';
  actions.innerHTML = items.map(c => `
    <div class="qa-card" onclick="goTo('${c.page}')">
      <div class="qa-icon ${c.qaIcon}"><i class="material-symbols-outlined">${c.icon}</i></div>
      <div><div class="qa-name">${escHTML(c.name)}</div><div class="qa-sub">${escHTML(c.sub)}</div></div>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', updateResponsiveNav);

let _navResizeRaf = null;
window.addEventListener('resize', () => {
  cancelAnimationFrame(_navResizeRaf);
  _navResizeRaf = requestAnimationFrame(updateResponsiveNav);
});

