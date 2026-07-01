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

function goTo(page) {
  closePinCard();
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + page).classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

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
  ['bugFab', 'mainFab', 'toggleFab'].forEach(id => {
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

// ── BOTTOM NAV AUTO-SHRINK ──
// Shrinks the floating bottom nav (smaller height, labels hidden, icon-only
// pills) and keeps it shrunk — it's a sticky state, not a timed one:
//   • Scrolling a page down  → shrink, and it stays shrunk.
//   • Scrolling a page up    → restore to full size.
//   • Panning/zooming a map  → shrink, and it stays shrunk
//     (only scrolling a page back up will restore it).
function setNavCompact(compact) {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  nav.classList.toggle('compact', compact);
  document.getElementById('app')?.classList.toggle('nav-compact', compact);
  // Drive every FAB's position directly: all of them sit at
  // calc(var(--nav-float-offset) + Npx), and --nav-float-offset is built
  // from --nav-float-h. Setting it inline here guarantees it wins over the
  // stylesheet value and recalculates every dependent calc() immediately.
  document.documentElement.style.setProperty('--nav-float-h', compact ? '52px' : '72px');
}

// Phase 13: Scroll-driven header elevation (M3 Top App Bar — elevation 0 → 2 on scroll)
// + direction-aware nav shrink (down = shrink & stay, up = restore)
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.page').forEach(page => {
    let lastScrollTop = page.scrollTop;
    page.addEventListener('scroll', () => {
      const header = document.querySelector('.app-header');
      header.classList.toggle('scrolled', page.scrollTop > 4);

      const st = page.scrollTop;
      if (st > lastScrollTop && st > 4) {
        setNavCompact(true);   // scrolling down
      } else if (st < lastScrollTop) {
        setNavCompact(false);  // scrolling up
      }
      lastScrollTop = st;
    }, { passive: true });
  });
});

