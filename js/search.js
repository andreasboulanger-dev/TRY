// ╔═══════════════════════════════════════════════════════════╗
// ║  GLOBAL SEARCH                                           ║
// ╚═══════════════════════════════════════════════════════════╝

// ── GLOBAL SEARCH ──
let searchDebounce = null;
let searchTabType  = 'all';

// The header search bar is global (always visible), but what it searches
// narrows to match whatever's actually on-screen for the current page —
// e.g. the Discounts (deals) map only ever shows deals + local prices
// (see renderDealMarkers in deals.js), never farms, so a farm result
// there wouldn't correspond to anything tappable on that map. `types`
// lists which entity kinds are in-scope for a page; anything not listed
// falls back to the general default (farms + deals).
const SEARCH_SCOPES = {
  deals: { types: ['deals', 'prices'], placeholder: 'Search deals, local prices, cities…' },
  farms: { types: ['farms'],           placeholder: 'Search farms, cities…' },
  default: { types: ['farms', 'deals'], placeholder: 'Search farms, deals, cities…' },
};

function currentSearchScope() {
  return SEARCH_SCOPES[currentPage] || SEARCH_SCOPES.default;
}

const SEARCH_TAB_DEFS = {
  all:    { label: 'All',          icon: null },
  farms:  { label: 'Farms',        icon: 'potted_plant' },
  deals:  { label: 'Deals',        icon: 'sell' },
  prices: { label: 'Local Prices', icon: 'payments' },
};

// Rebuilds the tab row + placeholder to match the current page's scope.
// Only called when the dropdown is opening fresh (see openSearchDropdown)
// so an in-progress search doesn't get its tab selection reset mid-type.
function renderSearchTabs() {
  const scope   = currentSearchScope();
  const tabsEl  = document.getElementById('searchTabs');
  const inputEl = document.getElementById('searchInput');
  if (!tabsEl) return;

  // An "All" tab only makes sense when there's more than one type to mix —
  // a single-type scope (e.g. Farms page) just gets that one tab.
  const tabKeys = scope.types.length > 1 ? ['all', ...scope.types] : scope.types;
  tabsEl.innerHTML = tabKeys.map((key, i) => {
    const def = SEARCH_TAB_DEFS[key];
    return `<button class="search-tab${i === 0 ? ' active' : ''}" data-type="${key}" onclick="switchSearchTab(this,'${key}')">${def.icon ? `<i class="material-symbols-outlined">${def.icon}</i> ` : ''}${def.label}</button>`;
  }).join('');
  searchTabType = tabKeys[0];

  if (inputEl) inputEl.placeholder = scope.placeholder;
  const emptyHint = document.querySelector('#searchResults .search-empty div');
  if (emptyHint) emptyHint.textContent = scope.placeholder;
}

function focusHeaderSearch() {
  const input = document.getElementById('searchInput');
  input.focus();
}

function onHeaderSearchFocus() {
  openSearchDropdown();
}

function openSearchDropdown() {
  const overlay = document.getElementById('searchOverlay');
  const modal   = document.getElementById('searchModal');
  // Re-scope only on a fresh open, not on every keystroke while it's
  // already open (that would clobber a tab the user just picked).
  if (!modal.classList.contains('open')) renderSearchTabs();
  overlay.classList.add('open');
  modal.classList.add('open');
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchModal').classList.remove('open');
  document.getElementById('searchInput').blur();
}

function clearHeaderSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  onSearchInput('');
  input.focus();
}

// Kept for backward compatibility with any lingering openSearch() callers —
// the header search bar is always visible now, so "opening search" just
// means focusing it (the dropdown then opens via onHeaderSearchFocus).
function openSearch() {
  focusHeaderSearch();
}

function switchSearchTab(btn, type) {
  document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  searchTabType = type;
  const q = document.getElementById('searchInput').value.trim();
  if (q.length >= 2) runSearch(q);
}

function onSearchInput(val) {
  clearTimeout(searchDebounce);
  const q = val.trim();
  document.getElementById('headerSearchClear').style.display = q.length ? 'flex' : 'none';

  if (q.length < 2) {
    const hint = currentSearchScope().placeholder;
    document.getElementById('searchResults').innerHTML = `<div class="search-empty"><i class="material-symbols-outlined" style="font-size:36px;color:var(--border-mid);">search</i><div>${escHTML(hint)}</div></div>`;
    if (q.length === 0) closeSearch(); else openSearchDropdown();
    return;
  }
  openSearchDropdown();
  document.getElementById('searchResults').innerHTML = '<div class="search-loading"><div class="spinner"></div>Searching…</div>';
  searchDebounce = setTimeout(() => runSearch(q), 350);
}

async function runSearch(q) {
  const enc = encodeURIComponent(q).replace(/\*/g, '%2A');
  const scope = currentSearchScope();
  const results = { farms: [], deals: [], prices: [] };

  const wantsFarms  = scope.types.includes('farms')  && (searchTabType === 'all' || searchTabType === 'farms');
  const wantsDeals  = scope.types.includes('deals')  && (searchTabType === 'all' || searchTabType === 'deals');
  const wantsPrices = scope.types.includes('prices') && (searchTabType === 'all' || searchTabType === 'prices');

  try {
    if (wantsFarms) {
      const rows = await supaFetch('businesses',
        `status=eq.approved&or=(business_name.ilike.*${enc}*,city.ilike.*${enc}*,state_region.ilike.*${enc}*,address.ilike.*${enc}*)&limit=40`
      );
      const seen = new Set();
      rows.forEach(f => {
        if (!seen.has(f.id)) { seen.add(f.id); results.farms.push(f); }
        // Merge into the global farms cache too — farms.js only loads farms
        // inside the map's current viewport, but a search hit may be
        // anywhere, so searchGoFarm() needs it available regardless.
        if (!farmLoadedIds.has(f.id)) { farmLoadedIds.add(f.id); allFarms.push(f); }
      });
    }
  } catch(e) { logError('search:farms', e); }

  try {
    if (wantsDeals) {
      // business_name/city live on the linked `venues` row now, not on
      // `deals` itself — filter the embedded relation with !inner so it
      // also narrows the top-level deals rows, not just the nested object.
      const [byName, byCity] = await Promise.all([
        supaFetch('deals', `status=in.(approved,negotiating)&select=*,venues!inner(*)&venues.business_name=ilike.*${enc}*&limit=20`),
        supaFetch('deals', `status=in.(approved,negotiating)&select=*,venues!inner(*)&venues.city=ilike.*${enc}*&limit=20`),
      ]);
      const seen = new Set();
      [...byName, ...byCity].map(flattenVenue).forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); results.deals.push(d); }
      });
    }
  } catch(e) { logError('search:deals', e); }

  try {
    if (wantsPrices) {
      // Same venues-relation trick as deals, plus a match on the item name
      // itself (e.g. "flat white") since that's what people actually
      // search a price list for.
      const [byName, byCity, byItem] = await Promise.all([
        supaFetch('local_prices', `status=eq.approved&select=*,venues!inner(*)&venues.business_name=ilike.*${enc}*&limit=20`),
        supaFetch('local_prices', `status=eq.approved&select=*,venues!inner(*)&venues.city=ilike.*${enc}*&limit=20`),
        supaFetch('local_prices', `status=eq.approved&item_name=ilike.*${enc}*&select=*,venues(*)&limit=20`),
      ]);
      // Group by venue (same key the deals map uses) so one matching venue
      // with several matching items shows as a single tappable result.
      const grouped = {};
      [...byName, ...byCity, ...byItem].map(flattenVenue).forEach(p => {
        const key = venueKeyOf(p, 'price');
        if (!grouped[key]) grouped[key] = { ...p, _venueKey: key, _matchedItems: [] };
        if (p.item_name && !grouped[key]._matchedItems.includes(p.item_name)) {
          grouped[key]._matchedItems.push(p.item_name);
        }
      });
      results.prices = Object.values(grouped);
    }
  } catch(e) { logError('search:prices', e); }

  renderSearchResults(results, q);
}

function highlightMatch(text, q) {
  if (!text) return '';
  const escaped = escHTML(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(re, '<mark class="search-hl">$1</mark>');
}

function renderSearchResults(results, q) {
  const el = document.getElementById('searchResults');
  const totalFarms  = results.farms.length;
  const totalDeals  = results.deals.length;
  const totalPrices = results.prices.length;

  if (!totalFarms && !totalDeals && !totalPrices) {
    el.innerHTML = `<div class="search-no-results"><i class="ti ti-mood-sad" style="font-size:32px;margin-bottom:8px;display:block;"></i>No results for "<strong>${escHTML(q)}</strong>"</div>`;
    return;
  }

  let html = '';

  if (totalFarms) {
    html += `<div class="search-section-label"><i class="ti ti-plant-2"></i> Farms & Businesses (${totalFarms})</div>`;
    results.farms.forEach(f => {
      const sub = [f.city, f.state_region, f.country].filter(Boolean).join(', ');
      const cat = escHTML(f.farm_category_first || 'Farm');
      const safeId = encodeURIComponent(f.id);
      const safeLat = parseFloat(f.latitude)||0;
      const safeLng = parseFloat(f.longitude)||0;
      html += `<div class="search-result-item" onclick="searchGoFarm(decodeURIComponent('${safeId}'),${safeLat},${safeLng})">
        <div class="search-result-icon farm">🌾</div>
        <div class="search-result-info">
          <div class="search-result-name">${highlightMatch(f.business_name, q)}</div>
          <div class="search-result-sub">${highlightMatch(sub, q)}${f.address ? ' · ' + highlightMatch(f.address, q) : ''}</div>
        </div>
        <span class="search-result-badge farm">${cat}</span>
      </div>`;
    });
  }

  if (totalDeals) {
    html += `<div class="search-section-label"><i class="ti ti-tag"></i> Deals (${totalDeals})</div>`;
    results.deals.forEach(d => {
      const sub = [d.city, d.country].filter(Boolean).join(', ');
      const pct = parseFloat(d.discount || 0);
      const bizType = escHTML(d.business_type || 'Business');
      const safeId = encodeURIComponent(d.id);
      html += `<div class="search-result-item" onclick="searchGoDeal(decodeURIComponent('${safeId}'))">
        <div class="search-result-icon deal">${dealEmoji[(d.business_type||'').toLowerCase()] || '🏪'}</div>
        <div class="search-result-info">
          <div class="search-result-name">${highlightMatch(d.business_name, q)}</div>
          <div class="search-result-sub">${highlightMatch(sub, q)} · ${bizType}</div>
        </div>
        ${pct > 0 ? `<span class="search-result-badge deal">-${pct}%</span>` : ''}
      </div>`;
    });
  }

  if (totalPrices) {
    html += `<div class="search-section-label"><i class="ti ti-coin"></i> Local Prices (${totalPrices})</div>`;
    results.prices.forEach(p => {
      const sub = [p.city, p.country].filter(Boolean).join(', ');
      const catLbl = escHTML(p.item_category_first || 'Local Price');
      const itemsSub = p._matchedItems && p._matchedItems.length ? p._matchedItems.slice(0, 2).join(', ') : catLbl;
      const safeKey = encodeURIComponent(p._venueKey);
      html += `<div class="search-result-item" onclick="searchGoPrice(decodeURIComponent('${safeKey}'))">
        <div class="search-result-icon deal">💰</div>
        <div class="search-result-info">
          <div class="search-result-name">${highlightMatch(p.business_name, q)}</div>
          <div class="search-result-sub">${highlightMatch(sub, q)} · ${highlightMatch(itemsSub, q)}</div>
        </div>
        <span class="search-result-badge deal" style="background:#E6F1FB;color:#185FA5;">${catLbl}</span>
      </div>`;
    });
  }

  html += '<div style="height:20px;"></div>';
  el.innerHTML = html;
}

// Polls `conditionFn` until it returns true, then calls `cb` — used below to
// wait out async map init / data loads (map creation, loadDeals() fetch)
// without hardcoding a single fixed delay that's either too short (marker
// not ready yet) or annoyingly long (map already had the data).
function _waitFor(conditionFn, cb, opts) {
  const interval = (opts && opts.interval) || 150;
  const timeout  = (opts && opts.timeout)  || 6000;
  const start = Date.now();
  (function check() {
    if (conditionFn()) { cb(); return; }
    if (Date.now() - start > timeout) return; // give up quietly — no crash, just no pin card
    setTimeout(check, interval);
  })();
}

// Selecting a farm from search: center the map on its real pin and open the
// exact same popup card a tap on that pin would show, instead of jumping to
// the standalone detail page.
function searchGoFarm(id, lat, lng) {
  closeSearch();
  goTo('farms');
  if (farmsViewMode !== 'map') toggleFarmsView();

  const openIt = () => {
    // Farms load lazily per-viewport with a category filter on top — reset
    // the filter to 'all' so this farm's pin isn't hidden once it loads in.
    if (!_activeFarmTypes.has('all')) {
      _activeFarmTypes.clear();
      _activeFarmTypes.add('all');
      document.querySelectorAll('#page-farms .filter-pill[data-ftype]').forEach(p => {
        p.classList.toggle('active', p.dataset.ftype === 'all');
      });
      applyFarmPillFilter();
    }
    if (lat && lng) flyTo(farmMap, lat, lng, 12);
    const f = allFarms.find(x => x.id === id);
    if (!f) return;
    // Popup is built straight from the farm data (identical markup to a
    // real pin tap) — no need to wait for the viewport marker itself to
    // finish loading in just to show the card.
    setTimeout(() => {
      openPinCard(buildFarmPopupHTML(f), { hideClose: true, onOpen: () => loadFarmPopupStars(f) });
    }, 650);
  };

  if (!farmMap) setTimeout(openIt, 900); else openIt();
}

// Selecting a deal from search: same idea — center on the real marker and
// fire its actual click handler so the popup (and any combined price info)
// is 100% identical to tapping the pin directly.
function searchGoDeal(id) {
  closeSearch();
  goTo('deals');
  if (dealsViewMode !== 'map') toggleDealsView();

  _waitFor(
    () => allDeals.some(d => d.id === id),
    () => {
      // Reset the category filter so this deal's marker can't be hidden
      // by whatever pill was active before the search.
      if (!_activeDealTypes.has('all')) applyDealTypeSelection('all');

      const d = allDeals.find(x => x.id === id);
      const key = venueKeyOf(d, 'deal');
      const marker = dealMarkers.find(m => m._hiveVenueKey === key);
      if (!marker) return;
      const ll = marker.getLatLng();
      flyTo(dealMap, ll.lat, ll.lng, dealMap.getMaxZoom());
      setTimeout(() => marker.fire('click'), 650);
    }
  );
}

// Selecting a local price from search: same idea as searchGoDeal — the
// price pin (and any combined deal) lives on the same deals map, keyed by
// the same per-venue key (see venueKeyOf() / renderDealMarkers() in
// deals.js), so we just fly to that marker and fire its real click handler.
function searchGoPrice(key) {
  closeSearch();
  goTo('deals');
  if (dealsViewMode !== 'map') toggleDealsView();

  _waitFor(
    () => dealMarkers.some(m => m._hiveVenueKey === key),
    () => {
      // Reset the category filter so this venue's marker can't be hidden
      // by whatever pill was active before the search.
      if (!_activeDealTypes.has('all')) applyDealTypeSelection('all');

      const marker = dealMarkers.find(m => m._hiveVenueKey === key);
      if (!marker) return;
      const ll = marker.getLatLng();
      flyTo(dealMap, ll.lat, ll.lng, dealMap.getMaxZoom());
      setTimeout(() => marker.fire('click'), 650);
    }
  );
}



