// ╔═══════════════════════════════════════════════════════════╗
// ║  ADVANCED FILTERS — Farms & Deals Filter Panels          ║
// ╚═══════════════════════════════════════════════════════════╝

// ── ADVANCED FILTERS ──
let advContext = null; // 'farms' | 'deals'

// Farm category groups (broad)
// Level 1 → farm_category_first values in DB
const FARM_CAT_GROUPS = {
  'Fruits & Orchards': ['fruits & orchards'],
  'Vegetables & Crops': ['vegetables & crops'],
  'Livestock':         ['livestock'],
  'Vineyard & Winery': ['vineyard & winery'],
  'Dairy':             ['dairy'],
  'Plants & Nursery':  ['plants & nursery'],
  'Aquaculture':       ['aquaculture'],
  'Honey':             ['honey'],
  'Poultry & Eggs':    ['poultry & eggs'],
  'Mixed & Specialty': ['mixed & specialty'],
  'Others':            ['others'],
};

// Level 2 → farm_category_second values per group
const FARM_SUBCAT_BY_GROUP = {
  'Fruits & Orchards': ['Fruits Farm'],
  'Vegetables & Crops': ['Vegetables Farm','Flowers Farm','Grains Farm','Mushrooms Farm','Nuts Farm','Seafood Farm','Cottons Farm'],
  'Livestock':         ['Cattle Farm','Livestock Breeder','Ranch','Sheeps Farm','Station','Alpacas Farm','Horse Stud','Pigs Farm','Goats Farm','Deer Farm','Emus/Ostriches Farm','Camel Farm','Donkey Farm'],
  'Vineyard & Winery': ['Vineyard'],
  'Dairy':             ['Dairy Farm'],
  'Plants & Nursery':  ['Plants Nursery','Wholesale Plant','Chrismas Tree','Tree Plantation'],
  'Aquaculture':       ['Aquaculture Farm','Fish Farm','Oyster Supplier','Pearls Farm'],
  'Honey':             ['Honey Farm'],
  'Poultry & Eggs':    ['Poultry Farm'],
  'Mixed & Specialty': ['Mixed Farm','Medicinal Cannabis Farm','Roadhouses'],
  'Others':            ['Other Farm'],
};

// Level 3 → farm_category_third values per subcat
const FARM_SUBSUBCAT_BY_SUBCAT = {
  'Fruits Farm':        ['Apples Farm','Berries Farm','Cherries Farm','Citrus Farm','Grapes Farm','Mangoes Farm','Orchard','Olive Farm','Strawberry Farm','Avocado Farm','Banana Farm','Fruits Farm','Mixed Farm'],
  'Vegetables Farm':    ['Vegetables Farm','Garlic Farm','Mixed Farm','Mushrooms Farm'],
  'Flowers Farm':       ['Flowers Farm','Lavender Farm'],
  'Mushrooms Farm':     ['Mushrooms Farm','Truffles'],
  'Nuts Farm':          ['Macadamia Farm','Almond Farm','Nuts Farm','Walnut Farm','Chestnut Farm'],
  'Cattle Farm':        ['Cattle Farm','Livestock Breeder','Mixed Farm','Sheeps Farm','Grains Farm','Horse Stud'],
  'Sheeps Farm':        ['Sheeps Farm','Livestock Breeder','Mixed Farm','Grains Farm'],
  'Ranch':              ['Livestock Breeder','Mixed Farm','Horse Stud','Sheeps Farm','Grains Farm'],
  'Alpacas Farm':       ['Alpacas Farm','Mixed Farm'],
  'Horse Stud':         ['Horse Stud','Livestock Breeder','Mixed Farm'],
  'Pigs Farm':          ['Poultry Farm'],
  'Aquaculture Farm':   ['Aquaculture Farm','Vegetables Farm'],
  'Fish Farm':          ['Fish Farm'],
  'Pearls Farm':        ['Pearls Farm','Other Farm'],
  'Dairy Farm':         ['Dairy Farm','Mixed Farm'],
  'Poultry Farm':       ['Eggs Farm','Poultry Farm'],
  'Mixed Farm':         ['Mixed Farm','Berries Farm','Strawberry Farm','Vegetables Farm','Grapes Farm','Orchard'],
};

// Community activity categories → matches ACT_COLORS/ACT_ICONS + filter pills in community.js
const ACTIVITY_CATS = [
  { v: 'outdoor',       l: 'Outdoor' },
  { v: 'sport',         l: 'Sport' },
  { v: 'nightlife',     l: 'Nightlife' },
  { v: 'food',          l: 'Food & Drinks' },
  { v: 'social',        l: 'Social' },
  { v: 'rideshare',     l: 'Rideshare' },
  { v: 'entertainment', l: 'Entertainment' },
  { v: 'sightseeing',   l: 'Sightseeing' },
  { v: 'shopping',      l: 'Shopping' },
  { v: 'wellness',      l: 'Wellness' },
];

// Deal type pills → mirrors the map's #page-deals filter bar exactly
// (icon + label + data-dtype in index.html). Single source of truth for
// the drawer's Main Category carousel so it always matches the map.
const DEAL_TYPE_PILLS = [
  { v: 'all',          icon: 'map',            l: 'All' },
  { v: 'bar',          icon: 'sports_bar',      l: 'Bars' },
  { v: 'coffee shop',  icon: 'local_cafe',      l: 'Cafés' },
  { v: 'deal',         icon: 'sell',            l: 'Deals' },
  { v: 'activity',     icon: 'directions_run',  l: 'Activities' },
  { v: 'hostel',       icon: 'bed',             l: 'Hostels' },
];

// Tracks the last active single deal-type so renderAdvPanel() can tell
// whether the Sub Category section is genuinely appearing (main category
// just changed) vs. just being re-rendered because a chip inside it was
// toggled — see subcatJustAppeared in renderAdvPanel().
let _advDealsLastMainType = undefined;

const advState = {
  farms: { countries:[], verified:false, accom:'any', days88:'any', minPay:25, organic:'any', catGroups:[], subcats:[], subSubcats:[] },
  deals: { countries:[], minDiscount:0, subFilters:[], rooftop:false, outsideArea:false },
  community: { cats:[], upcomingOnly:false },
};

// ── DRAG-TO-DISMISS ──
// Generic drag-down-to-close for any bottom sheet.
// sheetEl   : the sliding panel element
// onDismiss : called when dismissed
// keepX     : true for panels that use translateX(-50%) (adv-panel), false for modal-sheets
function initDragDismiss(sheetEl, onDismiss, keepX) {
  if (sheetEl._dragDismissAttached) return;
  sheetEl._dragDismissAttached = true;

  const DISMISS_THRESHOLD = 80;   // px downward
  const VELOCITY_THRESHOLD = 0.4; // px/ms flick
  let startY = 0, currentY = 0, dragging = false, startTime = 0;

  function setY(dy) {
    sheetEl.style.transform = keepX
      ? `translateX(-50%) translateY(${dy}px)`
      : `translateY(${dy}px)`;
  }

  function onTouchStart(e) {
    // Only drag from the handle pill or the top ~60px of the sheet
    const touch  = e.touches[0];
    const rect   = sheetEl.getBoundingClientRect();
    const relY   = touch.clientY - rect.top;
    const handle = sheetEl.querySelector('.modal-handle, .adv-panel-drag-handle, .bug-sheet-handle');
    const fromHandle = handle && handle.contains(e.target);
    if (!fromHandle && relY > 60) return;

    startY    = touch.clientY;
    currentY  = 0;
    dragging  = true;
    startTime = Date.now();
    sheetEl.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy < 0) return; // no dragging up
    currentY = dy;
    setY(dy);
    e.preventDefault();
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    const velocity = Date.now() - startTime > 0 ? currentY / (Date.now() - startTime) : 0;
    sheetEl.style.transition = '';
    if (currentY > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      setY(sheetEl.offsetHeight); // slide fully off-screen
      setTimeout(onDismiss, 280);
    } else {
      setY(0); // snap back
    }
    currentY = 0;
  }

  sheetEl.addEventListener('touchstart', onTouchStart, { passive: true });
  sheetEl.addEventListener('touchmove',  onTouchMove,  { passive: false });
  sheetEl.addEventListener('touchend',   onTouchEnd,   { passive: true });
}

// Auto-attach drag-to-dismiss to every bottom sheet once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // modal-backdrop → modal-sheet pairs + their close function
  const modalMap = {
    'submitModal':        () => closeSubmit(),
    'editLocalPriceModal':() => closeEditLocalPrice(),
    'editFarmModal':      () => document.getElementById('editFarmModal').classList.remove('open'),
    'newPostModal':       () => document.getElementById('newPostModal').classList.remove('open'),
    'communityAddModal':  () => document.getElementById('communityAddModal').classList.remove('open'),
    'newActivityModal':   () => document.getElementById('newActivityModal').classList.remove('open'),
    'reviewModal':        () => closeReviewModal(),
  };
  Object.entries(modalMap).forEach(([id, closeFn]) => {
    const backdrop = document.getElementById(id);
    if (!backdrop) return;
    const sheet = backdrop.querySelector('.modal-sheet');
    if (sheet) initDragDismiss(sheet, () => { sheet.style.transform = ''; closeFn(); }, false);
  });

  // Other custom sheets (not modal-backdrop pattern)
  const customSheets = [
    { sheetSel: '#bugSheetBackdrop .bug-sheet',            closeFn: () => closeBugSheet()       },
    { sheetSel: '#profileEditOverlay .profile-edit-sheet', closeFn: () => closeProfileEdit()    },
    { sheetSel: '#deleteConfirmOverlay .delete-confirm-sheet', closeFn: () => closeDeleteConfirm() },
  ];
  customSheets.forEach(({ sheetSel, closeFn }) => {
    const sheet = document.querySelector(sheetSel);
    if (sheet) initDragDismiss(sheet, () => { sheet.style.transform = ''; closeFn(); }, false);
  });

  // adv-panel uses translateX(-50%) so keepX = true — already wired via openAdvFilter,
  // but attach here too as a fallback in case it hasn't opened yet
  const advPanel = document.getElementById('advPanel');
  if (advPanel) initDragDismiss(advPanel, closeAdvFilter, true);
});

function openAdvFilter(ctx) {
  advContext = ctx;
  document.getElementById('advOverlay').classList.add('open');
  document.getElementById('advPanel').classList.add('open');
  initDragDismiss(document.getElementById('advPanel'), closeAdvFilter, true);
  renderAdvPanel(ctx);
}

function closeAdvFilter() {
  const panel = document.getElementById('advPanel');
  panel.style.transform = '';
  document.getElementById('advOverlay').classList.remove('open');
  panel.classList.remove('open');
}

function resetAdvFilter() {
  if (advContext === 'farms') {
    advState.farms = { countries:[], verified:false, accom:'any', days88:'any', minPay:25, organic:'any', catGroups:[], subcats:[], subSubcats:[] };
  } else if (advContext === 'community') {
    advState.community = { cats:[], upcomingOnly:false };
  } else {
    advState.deals = { countries:[], minDiscount:0, subFilters:[], rooftop:false, outsideArea:false };
    currentSubFilter = [];
    _advDealsLastMainType = undefined;
  }
  renderAdvPanel(advContext);
  updateAdvBadge(advContext);
}

function updateAdvBadge(ctx) {
  const f = advState.farms;
  const d = advState.deals;
  const c = advState.community;
  const hasFilters = ctx === 'farms'
    ? !!(f.countries.length || f.verified || f.accom !== 'any' || f.days88 !== 'any' || f.minPay > 25 || f.organic !== 'any' || f.catGroups.length || f.subcats.length || f.subSubcats.length)
    : ctx === 'community'
      ? !!(c.cats.length || c.upcomingOnly)
      : !!(d.countries.length || d.minDiscount > 0 || d.subFilters.length || d.rooftop || d.outsideArea);

  const btnIds = { farms:'farmsAdvBtn', deals:'dealsAdvBtn', community:'communityAdvBtn' };
  const btn = document.getElementById(btnIds[ctx]);
  if (!btn) return;
  btn.classList.toggle('has-filters', hasFilters);
  if (!btn.querySelector('.adv-dot')) btn.insertAdjacentHTML('beforeend', '<span class="adv-dot"></span>');
}

function renderAdvPanel(ctx) {
  const titles = { farms:'Farm Filters', deals:'Deal Filters', community:'Community Filters' };
  document.getElementById('advPanelTitle').textContent = titles[ctx] || 'Filters';

  let html = '';

  // ── Country (multi-select) — only relevant for farms & deals ──
  if (ctx === 'farms' || ctx === 'deals') {
    const countries = ['Australia', 'New Zealand'];
    const curCountries = advState[ctx]?.countries || [];
    html += `<div class="adv-section">
      <div class="adv-section-label">Country</div>
      <div class="adv-chips">
        ${countries.map(c => `<button class="adv-chip${curCountries.includes(c)?' active':''}" onclick="advToggleCountry('${c}')">${c}</button>`).join('')}
      </div>
    </div>`;
  }

  if (ctx === 'farms') {
    const s = advState.farms;

    // ── Tristate selectors (yes / any / no) ──
    const tristateRow = (label, sub, field, val) => `
      <div class="adv-row">
        <div><div class="adv-row-label">${label}</div><div class="adv-row-sub">${sub}</div></div>
        <div class="adv-tristate">
          <button class="adv-tri-btn${val==='yes'?' active-yes':''}" onclick="advSetTristate('${field}','yes')">Yes</button>
          <button class="adv-tri-btn${val==='any'?' active-any':''}" onclick="advSetTristate('${field}','any')">Any</button>
          <button class="adv-tri-btn${val==='no'?' active-no':''}" onclick="advSetTristate('${field}','no')">No</button>
        </div>
      </div>`;
    html += `<div class="adv-section">
      <div class="adv-section-label">Farm options</div>
      <div class="adv-row">
        <div>
          <div class="adv-row-label"><i class="ti ti-rosette-discount-check" style="color:#185FA5;font-size:14px;vertical-align:-2px;margin-right:3px;"></i>Verified by admin</div>
          <div class="adv-row-sub">Only show admin-checked farms</div>
        </div>
        <button class="adv-verified-btn${s.verified?' adv-verified-on':''}" onclick="advToggleVerified()">${s.verified?'<i class=\'ti ti-rosette-discount-check\'></i> On':'Off'}</button>
      </div>
      ${tristateRow('Accommodation included','Farm provides housing','accom',s.accom)}
      ${tristateRow('88-day visa eligible','Counts toward regional work','days88',s.days88)}
      ${tristateRow('Organic','Certified or described as organic','organic',s.organic)}
    </div>`;

    // ── Min pay ──
    html += `<div class="adv-section">
      <div class="adv-section-label">Min. pay rate</div>
      <div class="adv-range-row">
        <input type="range" min="25" max="60" step="1" value="${s.minPay}" oninput="advPayRange(this)">
        <span class="adv-range-val" id="advPayVal">${s.minPay>25?'$'+s.minPay+'/hr':'Any'}</span>
      </div>
    </div>`;

    // ── Category groups ──
    const groups = Object.keys(FARM_CAT_GROUPS);
    html += `<div class="adv-section">
      <div class="adv-section-label">Category</div>
      <div class="adv-chips">
        <button class="adv-chip${!s.catGroups.length?' active':''}" onclick="advSetFarmCat('')">All</button>
        ${groups.map(g => `<button class="adv-chip${s.catGroups.includes(g)?' active':''}" onclick="advSetFarmCat('${g}')">${g}</button>`).join('')}
      </div>
    </div>`;

    // ── Subcategories (shown when exactly one group selected) ──
    if (s.catGroups.length === 1 && FARM_SUBCAT_BY_GROUP[s.catGroups[0]]) {
      const subs = FARM_SUBCAT_BY_GROUP[s.catGroups[0]];
      html += `<div class="adv-section">
        <div class="adv-section-label" style="display:flex;align-items:center;gap:6px;">More specific <span style="font-size:10px;background:var(--amber-light);color:var(--amber-dark);padding:2px 7px;border-radius:10px;font-weight:600;">${s.catGroups[0]}</span></div>
        <div class="adv-chips">
          ${subs.map(sub => `<button class="adv-chip${s.subcats.includes(sub)?' active':''}" onclick="advToggleSubcat('${sub}')">${sub}</button>`).join('')}
        </div>
      </div>`;
    }

    // ── Sub-subcategories (shown when any subcat with sub-subs is active) ──
    const activeSubsWithDeep = s.subcats.filter(sub => FARM_SUBSUBCAT_BY_SUBCAT[sub]);
    if (activeSubsWithDeep.length) {
      activeSubsWithDeep.forEach(sub => {
        const subSubs = FARM_SUBSUBCAT_BY_SUBCAT[sub];
        html += `<div class="adv-section">
          <div class="adv-section-label" style="display:flex;align-items:center;gap:6px;">Even more specific <span style="font-size:10px;background:var(--amber-light);color:var(--amber-dark);padding:2px 7px;border-radius:10px;font-weight:600;">${sub}</span></div>
          <div class="adv-chips">
            ${subSubs.map(ss => `<button class="adv-chip${s.subSubcats.includes(ss)?' active':''}" onclick="advToggleSubSubcat('${ss}')">${ss}</button>`).join('')}
          </div>
        </div>`;
      });
    }
  }

  if (ctx === 'deals') {
    const s = advState.deals;

    // ── Main Category (carousel) ──
    // Same pills as the map's filter bar (data-dtype in index.html), all
    // reading/writing the shared _activeDealTypes set — so picking a
    // category here or on the map keeps both in sync automatically.
    html += `<div class="adv-section">
      <div class="adv-section-label">Main category</div>
      <div class="adv-carousel">
        ${DEAL_TYPE_PILLS.map(dt => `<button class="adv-carousel-chip${_activeDealTypes.has(dt.v)?' active':''}" onclick="advToggleDealType('${dt.v}')"><i class="material-symbols-outlined">${dt.icon}</i>${dt.l}</button>`).join('')}
      </div>
    </div>`;

    // ── Sub Category (carousel, multi-choice) ──
    // Only meaningful once a single deal category is active (see
    // toggleDealPill/applyDealPillFilter in deals.js), since item names
    // are specific to one category.
    const singleType = (!_activeDealTypes.has('all') && _activeDealTypes.size === 1) ? [..._activeDealTypes][0] : null;
    const subFilterableTypes = new Set(['bar', 'coffee shop', 'hostel', 'activity', 'deal']);

    // The section should play its "appear" animation only when it's
    // genuinely entering (the active main category just changed) — not on
    // every subsequent tap of a sub-category chip, which would otherwise
    // re-trigger it on every render since renderAdvPanel rebuilds the DOM.
    const subcatJustAppeared = singleType !== _advDealsLastMainType;
    _advDealsLastMainType = singleType;

    if (singleType && subFilterableTypes.has(singleType)) {
      const itemSet = new Set();
      _allPricesMaster.forEach(p => {
        const cat = normalizePriceCat(p.item_category_first);
        if (cat === singleType && p.item_name) itemSet.add(p.item_name.trim());
      });
      if (itemSet.size) {
        const labelMap = {
          'bar': '🍺 Beer / Drink',
          'coffee shop': '☕ Coffee type',
          'hostel': '🛏️ Item',
          'activity': '🏄 Activity',
          'deal': '🏷️ Deal type'
        };
        const label = labelMap[singleType] || '🔍 Item';
        html += `<div class="adv-section${subcatJustAppeared ? ' adv-section-anim-in' : ''}">
          <div class="adv-section-label">Sub category <span class="adv-section-sub-label">— ${label}</span></div>
          <div class="adv-carousel">
            <button class="adv-carousel-chip${!s.subFilters.length?' active':''}" onclick="advToggleSubFilterItem('')">All</button>
            ${[...itemSet].sort().map(name => {
              const safeName = encodeURIComponent(name);
              return `<button class="adv-carousel-chip${s.subFilters.includes(name)?' active':''}" onclick="advToggleSubFilterItem(decodeURIComponent('${safeName}'))">${escHTML(name)}</button>`;
            }).join('')}
          </div>
        </div>`;
      }
    }

    html += `<div class="adv-section">
      <div class="adv-section-label">Min. discount</div>
      <div class="adv-range-row">
        <input type="range" min="0" max="50" step="5" value="${s.minDiscount}" oninput="advDiscountRange(this)">
        <span class="adv-range-val" id="advDiscVal">${s.minDiscount>0?s.minDiscount+'%+':'Any'}</span>
      </div>
    </div>`;

    // ── Amenities ──
    html += `<div class="adv-section">
      <div class="adv-section-label">Amenities</div>
      <div class="adv-row">
        <div><div class="adv-row-label">Rooftop</div></div>
        <button class="adv-toggle${s.rooftop?' on':''}" onclick="advToggleDealAmenity('rooftop')"></button>
      </div>
      <div class="adv-row">
        <div><div class="adv-row-label">Outside area</div></div>
        <button class="adv-toggle${s.outsideArea?' on':''}" onclick="advToggleDealAmenity('outsideArea')"></button>
      </div>
      <div class="adv-row adv-row-disabled">
        <div>
          <div class="adv-row-label">Sunny</div>
          <div class="adv-row-sub">Available soon</div>
        </div>
        <button class="adv-toggle" disabled></button>
      </div>
    </div>`;
  }

  if (ctx === 'community') {
    const s = advState.community;

    html += `<div class="adv-section">
      <div class="adv-row">
        <div>
          <div class="adv-row-label">Upcoming only</div>
          <div class="adv-row-sub">Hide activities that already happened</div>
        </div>
        <button class="adv-verified-btn${s.upcomingOnly?' adv-verified-on':''}" onclick="advToggleUpcomingOnly()">${s.upcomingOnly?'<i class=\'ti ti-rosette-discount-check\'></i> On':'Off'}</button>
      </div>
    </div>`;

    html += `<div class="adv-section">
      <div class="adv-section-label">Category</div>
      <div class="adv-chips">
        <button class="adv-chip${!s.cats.length?' active':''}" onclick="advSetActivityCat('')">All</button>
        ${ACTIVITY_CATS.map(c => `<button class="adv-chip${s.cats.includes(c.v)?' active':''}" onclick="advSetActivityCat('${c.v}')">${c.l}</button>`).join('')}
      </div>
    </div>`;
  }

  document.getElementById('advPanelBody').innerHTML = html;
}

function advToggleCountry(c) {
  const arr = advState[advContext].countries;
  const idx = arr.indexOf(c);
  if (idx === -1) arr.push(c); else arr.splice(idx, 1);
  renderAdvPanel(advContext);
}

function advSetTristate(field, val) {
  advState.farms[field] = val;
  renderAdvPanel(advContext);
}

function advToggleVerified() {
  advState.farms.verified = !advState.farms.verified;
  const v = advState.farms.verified;
  if (v) { _activeFarmTypes.add('verified'); _activeFarmTypes.delete('all'); }
  else   { _activeFarmTypes.delete('verified'); if (_activeFarmTypes.size === 0) _activeFarmTypes.add('all'); }
  document.querySelectorAll('#page-farms .filter-pill[data-ftype]').forEach(p => {
    p.classList.toggle('active', _activeFarmTypes.has(p.dataset.ftype));
  });
  renderAdvPanel(advContext);
}

function advSetFarmCat(g) {
  const arr = advState.farms.catGroups;
  if (g === '') {
    // "All" clears everything
    advState.farms.catGroups = [];
    advState.farms.subcats = [];
    advState.farms.subSubcats = [];
  } else {
    const idx = arr.indexOf(g);
    if (idx === -1) {
      arr.push(g);
    } else {
      arr.splice(idx, 1);
    }
    // Clear subcats/subSubcats when switching away from a single group
    if (advState.farms.catGroups.length !== 1) {
      advState.farms.subcats = [];
      advState.farms.subSubcats = [];
    }
  }
  renderAdvPanel('farms');
}

function advToggleSubcat(sub) {
  const arr = advState.farms.subcats;
  const idx = arr.indexOf(sub);
  if (idx === -1) arr.push(sub); else arr.splice(idx, 1);
  // Clear sub-subcats that belonged to a deselected subcat
  advState.farms.subSubcats = advState.farms.subSubcats.filter(ss =>
    advState.farms.subcats.some(s => (FARM_SUBSUBCAT_BY_SUBCAT[s]||[]).includes(ss))
  );
  renderAdvPanel('farms');
}

function advToggleSubSubcat(ss) {
  const arr = advState.farms.subSubcats;
  const idx = arr.indexOf(ss);
  if (idx === -1) arr.push(ss); else arr.splice(idx, 1);
  renderAdvPanel('farms');
}

function advPayRange(input) {
  advState.farms.minPay = parseInt(input.value);
  const el = document.getElementById('advPayVal');
  if (el) el.textContent = advState.farms.minPay > 25 ? '$'+advState.farms.minPay+'/hr' : 'Any';
}

function advDiscountRange(input) {
  advState.deals.minDiscount = parseInt(input.value);
  const el = document.getElementById('advDiscVal');
  if (el) el.textContent = advState.deals.minDiscount > 0 ? advState.deals.minDiscount+'%+' : 'Any';
}

// Rooftop / Outside area amenity toggles. Sunny is intentionally not wired
// up here — it's rendered disabled ("Available soon") until that data exists.
function advToggleDealAmenity(field) {
  advState.deals[field] = !advState.deals[field];
  renderAdvPanel('deals');
}

// Sub Category is multi-choice: tapping an item toggles it in/out of the
// selection; tapping "All" (empty name) clears the whole selection.
function advToggleSubFilterItem(name) {
  if (!name) {
    advState.deals.subFilters = [];
  } else {
    const arr = advState.deals.subFilters;
    const idx = arr.indexOf(name);
    if (idx === -1) arr.push(name); else arr.splice(idx, 1);
  }
  renderAdvPanel('deals');
}

// Main Category carousel in the drawer — delegates to the same shared
// selection logic the map pills use (see applyDealTypeSelection in
// deals.js), so both stay in sync in either direction.
function advToggleDealType(type) {
  applyDealTypeSelection(type);
}

function advSetActivityCat(cat) {
  const arr = advState.community.cats;
  if (cat === '') {
    advState.community.cats = [];
  } else {
    const idx = arr.indexOf(cat);
    if (idx === -1) arr.push(cat); else arr.splice(idx, 1);
  }
  renderAdvPanel('community');
}

function advToggleUpcomingOnly() {
  advState.community.upcomingOnly = !advState.community.upcomingOnly;
  renderAdvPanel('community');
}

function applyAdvFilter() {
  closeAdvFilter();
  updateAdvBadge(advContext);

  if (advContext === 'farms') {
    const s = advState.farms;

    // Sync back to the pill bar when adv filter applies category selections
    (function syncPillToAdv() {
      _activeFarmTypes.clear();
      if (s.verified) _activeFarmTypes.add('verified');
      if (s.days88 === 'yes') _activeFarmTypes.add('88days');
      if (s.catGroups && s.catGroups.length) {
        // For each selected catGroup, find all pills that map to it
        s.catGroups.forEach(grp => {
          const entries = typeof PILL_TO_ADV_CAT !== 'undefined'
            ? Object.entries(PILL_TO_ADV_CAT).filter(([k, v]) => v === grp && k !== 'all' && k !== '88days' && k !== 'verified')
            : [];
          entries.forEach(([k]) => _activeFarmTypes.add(k));
        });
      }
      if (_activeFarmTypes.size === 0) _activeFarmTypes.add('all');
      document.querySelectorAll('#page-farms .filter-pill[data-ftype]').forEach(p => {
        p.classList.toggle('active', _activeFarmTypes.has(p.dataset.ftype));
      });
    })();

    let filtered = allFarms.filter(f => {
      if (s.verified && !(f.last_checked_by && f.last_checked_by.trim())) return false;
      if (s.countries.length && !s.countries.some(c => (f.country||'').toLowerCase() === c.toLowerCase())) return false;
      if (s.accom !== 'any') {
        const accVal = (f.accommodation||'unknown').toLowerCase();
        const accYes = accVal === 'yes';
        if (s.accom === 'yes' && !accYes) return false;
        if (s.accom === 'no'  &&  accYes) return false;
      }
      if (s.days88 !== 'any') {
        const d88 = (f.eighty_eight_days||'unknown').toLowerCase();
        if (s.days88 === 'yes' && d88 !== 'yes') return false;
        if (s.days88 === 'no'  && d88 !== 'no')  return false;
      }
      if (s.minPay > 25 && (parseFloat(f.pay_per_hour_aud)||0) < s.minPay) return false;
      if (s.organic !== 'any') {
        const org = (f.organic||'unknown').toLowerCase();
        if (s.organic === 'yes' && org !== 'yes') return false;
        if (s.organic === 'no'  && org !== 'no')  return false;
      }
      if (s.catGroups && s.catGroups.length) {
        const cat1 = (f.farm_category_first||'').toLowerCase();
        const matched = s.catGroups.some(grp => {
          const groupVals = FARM_CAT_GROUPS[grp] || [];
          return groupVals.some(g => cat1 === g);
        });
        if (!matched) return false;
      }
      if (s.subcats.length) {
        const cat2 = (f.farm_category_second||'').toLowerCase();
        const matched = s.subcats.some(sub => cat2 === sub.toLowerCase());
        if (!matched) return false;
      }
      if (s.subSubcats.length) {
        const cat3 = (f.farm_category_third||'').toLowerCase();
        const matched = s.subSubcats.some(ss => cat3 === ss.toLowerCase());
        if (!matched) return false;
      }
      return true;
    });
    currentFilteredFarms = filtered;
    renderFarmMarkers(filtered);
    renderFarmsList(filtered);
  } else if (advContext === 'deals') {
    const s = advState.deals;

    // Main Category carousel writes straight into _activeDealTypes (same
    // set the map pills use), so apply it here alongside country/discount.
    const types = [..._activeDealTypes];
    const singleType = (!_activeDealTypes.has('all') && types.length === 1) ? types[0] : null;

    let filtered = allDeals.filter(d => {
      if (s.countries.length && !s.countries.some(c => (d.country||'').toLowerCase() === c.toLowerCase())) return false;
      if (s.minDiscount > 0 && (parseFloat(d.discount)||0) < s.minDiscount) return false;
      if (s.rooftop && !d.rooftop) return false;
      if (s.outsideArea && !d.outside_area) return false;
      if (!_activeDealTypes.has('all')) {
        const bt = (d.business_type||'').toLowerCase();
        if (!types.some(t => bt.includes(t))) return false;
      }
      return true;
    });
    currentFilteredDeals = filtered;
    currentSubFilter = [...s.subFilters];
    // Keep currentDealsType in sync too (previously only the quick pill bar
    // in applyDealPillFilter set this). Both this and currentSubFilter are
    // what map.js's periodic refreshPricePinLabels() reads to reproduce the
    // exact same filtered pins/cards on its full re-renders — without this,
    // the drawer's category choice would get silently dropped on the next
    // happy-hour refresh even though the sub-category choice was kept.
    currentDealsType = singleType || 'all';

    // Single active category (see toggleDealPill/applyDealPillFilter) is what
    // the item sub-filter was built against — apply it to the price pins the
    // same way the old on-map dropdown did. Shared with map.js's periodic
    // refresh via getCurrentDealsOverridePrices() (deals.js).
    const overridePrices = getCurrentDealsOverridePrices();

    renderDealMarkers(filtered, singleType || 'all', overridePrices);
    renderDealsList(filtered);
  } else if (advContext === 'community') {
    const s = advState.community;

    // Sync back to the pill bar so the active category pill(s) reflect the adv filter
    document.querySelectorAll('#activityFilters .filter-pill').forEach(p => {
      const cat = p.dataset.actcat;
      if (cat === 'all') {
        p.classList.toggle('active', !s.cats.length);
      } else {
        p.classList.toggle('active', s.cats.includes(cat));
      }
    });

    const today = new Date().toISOString().split('T')[0];
    let filtered = allActivities.filter(a => {
      if (s.cats.length && !s.cats.includes(a.cat)) return false;
      if (s.upcomingOnly && a.date && a.date < today) return false;
      return true;
    });
    renderActivityMarkers(filtered);
  }
}



