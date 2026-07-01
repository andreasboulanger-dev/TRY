// ╔═══════════════════════════════════════════════════════════╗
// ║  GLOBAL SEARCH                                           ║
// ╚═══════════════════════════════════════════════════════════╝

// ── GLOBAL SEARCH ──
let searchDebounce = null;
let searchTabType  = 'all';

function focusHeaderSearch() {
  const input = document.getElementById('searchInput');
  input.focus();
}

function onHeaderSearchFocus() {
  openSearchDropdown();
}

function openSearchDropdown() {
  document.getElementById('searchOverlay').classList.add('open');
  document.getElementById('searchModal').classList.add('open');
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
    document.getElementById('searchResults').innerHTML = '<div class="search-empty"><i class="material-symbols-outlined" style="font-size:36px;color:var(--border-mid);">search</i><div>Search farms, deals, cities…</div></div>';
    if (q.length === 0) closeSearch(); else openSearchDropdown();
    return;
  }
  openSearchDropdown();
  document.getElementById('searchResults').innerHTML = '<div class="search-loading"><div class="spinner"></div>Searching…</div>';
  searchDebounce = setTimeout(() => runSearch(q), 350);
}

async function runSearch(q) {
  const enc = encodeURIComponent(q).replace(/\*/g, '%2A');
  const results = { farms: [], deals: [] };

  try {
    if (searchTabType === 'all' || searchTabType === 'farms') {
      const rows = await supaFetch('businesses',
        `status=eq.approved&or=(business_name.ilike.*${enc}*,city.ilike.*${enc}*,state_region.ilike.*${enc}*,address.ilike.*${enc}*)&limit=40`
      );
      const seen = new Set();
      rows.forEach(f => { if (!seen.has(f.id)) { seen.add(f.id); results.farms.push(f); } });
    }
  } catch(e) { logError('search:farms', e); }

  try {
    if (searchTabType === 'all' || searchTabType === 'deals') {
      const [byName, byCity] = await Promise.all([
        supaFetch('deals', `status=in.(approved,negotiating)&business_name=ilike.*${enc}*&limit=20`),
        supaFetch('deals', `status=in.(approved,negotiating)&city=ilike.*${enc}*&limit=20`),
      ]);
      const seen = new Set();
      [...byName, ...byCity].forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); results.deals.push(d); }
      });
    }
  } catch(e) { logError('search:deals', e); }

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
  const totalFarms = results.farms.length;
  const totalDeals = results.deals.length;

  if (!totalFarms && !totalDeals) {
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

  html += '<div style="height:20px;"></div>';
  el.innerHTML = html;
}

function searchGoFarm(id, lat, lng) {
  closeSearch();
  goTo('farms');
  if (!farmMap) {
    setTimeout(() => { flyTo(farmMap, lat, lng, 13); openFarmDetail(id); }, 800);
  } else {
    flyTo(farmMap, lat, lng, 13);
    setTimeout(() => openFarmDetail(id), 600);
  }
}

function searchGoDeal(id) {
  closeSearch();
  goTo('deals');
  setTimeout(() => openDealDetail(id), 600);
}



