// ╔═══════════════════════════════════════════════════════════╗
// ║  FARMS — Map, List, Filters, Farm Detail                 ║
// ╚═══════════════════════════════════════════════════════════╝

// ── FARMS MAP ──
let farmsViewMode = 'map';

// ── GEOLOCATION HELPER ──
// Resolves with {lat, lng} if granted, null if denied/unavailable
function getUserLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

function initFarmMap() {
  window.farmMap = farmMap = L.map('farmMap', {center:[-30,147], zoom:4, zoomControl:false});
  bindPinCardOutsideClose(farmMap);
  L.tileLayer(TILE_URL, {attribution:TILE_ATTR, maxZoom:19}).addTo(farmMap);
  liftMapAttribution(farmMap, 'farms');
  farmMap.on('movestart zoomstart move zoom', () => setNavCompact(true));
  setTimeout(() => farmMap.invalidateSize(), 100);
  getUserLocation().then(pos => {
    if (pos) farmMap.setView([pos.lat, pos.lng], 9);
  });
  loadFarms();
}

let farmLoadedIds = new Set();
let farmLoadingViewport = false;
let farmViewportDebounce = null;

async function loadFarms() {
  // Load farms for current viewport
  await loadFarmsInViewport();

  // Listen for map moves
  farmMap.on('moveend zoomend', () => {
    clearTimeout(farmViewportDebounce);
    farmViewportDebounce = setTimeout(loadFarmsInViewport, 400);
  });
}

async function loadFarmsInViewport() {
  if (farmLoadingViewport) return;
  farmLoadingViewport = true;
  try {
    const b = farmMap.getBounds();
    const pad = 0.5; // padding in degrees
    const minLat = Math.max(b.getSouth() - pad, -90);
    const maxLat = Math.min(b.getNorth() + pad, 90);
    const minLng = Math.max(b.getWest()  - pad, -180);
    const maxLng = Math.min(b.getEast()  + pad, 180);

    const params = `status=eq.approved&latitude=gte.${minLat}&latitude=lte.${maxLat}&longitude=gte.${minLng}&longitude=lte.${maxLng}&limit=500`;
    const farms = await supaFetch('businesses', params);

    // Add only new farms to cache
    const newFarms = farms.filter(f => !farmLoadedIds.has(f.id));

    newFarms.forEach(f => { farmLoadedIds.add(f.id); allFarms.push(f); });

    // Detect active filter from the multi-select state
    if (_activeFarmTypes.has('all')) {
      if (newFarms.length) {
        addFarmMarkers(newFarms);
        currentFilteredFarms = allFarms;
        renderFarmsList(allFarms);
      }
    } else {
      // Always re-apply the multi-select filter so the map stays accurate
      applyFarmPillFilter();
    }
  } catch(e) {
    console.error('loadFarmsInViewport error', e);
  } finally {
    farmLoadingViewport = false;
  }
}

function addFarmMarkers(farms) {
  if (!farmCluster) {
    farmCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="farm-cluster-icon">${count}</div>`,
          className: '',
          iconSize: L.point(36, 36)
        });
      }
    });
    farmMap.addLayer(farmCluster);
  }
  farms.forEach(f => {
    const lat = parseFloat(f.latitude), lng = parseFloat(f.longitude);
    if (isNaN(lat)||isNaN(lng)) return;
    const t = (f.farm_category_first||'').toLowerCase();
    const icon = makePin(farmEmoji[t]||farmEmoji.default, farmColors[t]||farmColors.default);
    const pay  = f.pay_per_hour_aud ? `<span class="badge pay">$${f.pay_per_hour_aud}/hr</span>` : '';
    const acc  = f.accommodation && f.accommodation.toLowerCase() === 'yes' ? `<span class="badge deal">Housing</span>` : '';
    const is88popup = (f.eighty_eight_days||'').toLowerCase() === 'yes' ? `<span class="badge u-price-label-blue">88 days</span>` : '';
    const verifiedIcon = (f.last_checked_by && f.last_checked_by.trim()) ? `<i class="material-symbols-outlined icon-filled" style="color:#185FA5;font-size:15px;vertical-align:-2px;margin-left:5px;">check_circle</i>` : '';
    const popupHTML = `<div class="popup-inner"><div class="popup-name">${escHTML(f.business_name)}${verifiedIcon}</div><div class="popup-detail" style="display:flex;align-items:center;gap:6px;">${escHTML(f.city||'')}${f.state_region?', '+escHTML(f.state_region):''} · ${escHTML(f.country||'')}<span id="popup-stars-${f.id}" style="display:inline-flex;align-items:center;gap:2px;margin-left:2px;"></span></div><div class="popup-badges"><span class="badge">${escHTML(f.farm_category_first||'Farm')}</span>${pay}${acc}${is88popup}</div>${f.notes?`<div style="font-size:12px;color:var(--text-light);margin-bottom:10px;">${escHTML(f.notes)}</div>`:''}<button class="popup-btn" onclick="openFarmDetail('${f.id}')">View details</button></div>`;
    const marker = L.marker([lat,lng],{icon});
    marker.on('click', function() {
      openPinCard(popupHTML, {
        onOpen: function() {
          const span = document.getElementById('popup-stars-' + f.id);
          if (!span || span.dataset.loaded) return;
          span.dataset.loaded = '1';
          loadFarmReviews(f.id).then(reviews => {
            if (!reviews.length) return; // no reviews → show nothing, not 5 empty stars
            const avg = reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length;
            span.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--amber-dark);">${avg.toFixed(1)}</span>` + starsHTML(avg,'sm');
          });
        }
      });
    });
    farmMarkers.push(marker);
    farmCluster.addLayer(marker);
  });
}

const farmColors = {
  'fruits & orchards':'#2E7D32',
  'livestock':'#6D4C41',
  'plants & nursery':'#388E3C',
  'vineyard & winery':'#4527A0',
  'vegetables & crops':'#00796B',
  'honey':'#F9A825',
  'poultry & eggs':'#EF6C00',
  'dairy':'#0277BD',
  'aquaculture':'#00838F',
  'mixed & specialty':'#558B2F',
  'others':'#78909C',
  'default':'#D4851A'
};
const farmEmoji = {
  'fruits & orchards':'🍎',
  'livestock':'🐄',
  'plants & nursery':'🌱',
  'vineyard & winery':'🍇',
  'vegetables & crops':'🥦',
  'honey':'🍯',
  'poultry & eggs':'🐔',
  'dairy':'🥛',
  'aquaculture':'🦐',
  'mixed & specialty':'🚜',
  'others':'🌾',
  'default':'🌾'
};

function renderFarmMarkers(farms) {
  if (!farmMap) return;
  // Reset cluster and reload with filtered set
  if (farmCluster) { farmMap.removeLayer(farmCluster); farmCluster = null; }
  farmMarkers = [];
  addFarmMarkers(farms);
}

function renderFarmsList(farms) {
  const el = document.getElementById('farmsListScroll');
  if (!farms.length) { el.innerHTML = '<div class="map-loading">No farms found.</div>'; return; }
  const sorted = [...farms].sort((a, b) => (a.business_name||'').localeCompare(b.business_name||'', undefined, {numeric:true, sensitivity:'base'}));
  el.innerHTML = sorted.map(f => `<div class="farm-row" onclick="flyTo(farmMap,${f.latitude},${f.longitude},10);if(farmsViewMode==='list')toggleFarmsView();"><div class="farm-icon-wrap"><i class="material-symbols-outlined">potted_plant</i></div><div class="farm-info"><div class="farm-name">${escHTML(f.business_name)}</div><div class="farm-meta">${escHTML(f.city||'')}${f.state_region?', '+escHTML(f.state_region):''} · ${escHTML(f.farm_category_first||'Farm')}</div></div>${f.pay_per_hour_aud?`<span class="farm-chip">$${f.pay_per_hour_aud}/hr</span>`:''}</div>`).join('') + '<div style="height:100px;"></div>';
}

const farmFilterGroups = {
  'fruits':     ['fruits & orchards'],
  'livestock':  ['livestock'],
  'nursery':    ['plants & nursery'],
  'vineyard':   ['vineyard & winery'],
  'vegetables': ['vegetables & crops'],
  'honey':      ['honey'],
  'poultry':    ['poultry & eggs'],
  'dairy':      ['dairy'],
  'aquaculture':['aquaculture'],
  'mixed':      ['mixed & specialty', 'others'],
  '88days':     null
};

function filterFarmsType(type) {
  let f;
  if (type === 'all') {
    f = allFarms;
  } else if (type === '88days') {
    f = allFarms.filter(f => (f.eighty_eight_days||'').toLowerCase() === 'yes');
  } else {
    const group = farmFilterGroups[type];
    if (group) {
      f = allFarms.filter(f => group.includes((f.farm_category_first||'').toLowerCase()));
    } else {
      f = allFarms.filter(f => (f.farm_category_first||'').toLowerCase().includes(type));
    }
  }
  currentFilteredFarms = f;
  renderFarmsList(f);
  return f;
}

// Map pill filter keys to advState catGroup names (or special flags)
const PILL_TO_ADV_CAT = {
  'all':         '',
  'verified':    '__verified__',
  '88days':      '__88days__',
  'fruits':      'Fruits & Orchards',
  'livestock':   'Livestock',
  'nursery':     'Plants & Nursery',
  'vineyard':    'Vineyard & Winery',
  'vegetables':  'Vegetables & Crops',
  'honey':       'Mixed & Specialty',
  'poultry':     'Mixed & Specialty',
  'dairy':       'Dairy',
  'aquaculture': 'Aquaculture',
  'mixed':       'Mixed & Specialty',
};

// ── Multi-select pill state ── (declared in state.js)

function toggleFarmPill(btn) {
  const type = btn.dataset.ftype;
  const allBtn = document.querySelector('#page-farms .filter-pill[data-ftype="all"]');

  if (type === 'all') {
    // "All" resets everything
    _activeFarmTypes.clear();
    _activeFarmTypes.add('all');
  } else {
    // Toggle the clicked type
    if (_activeFarmTypes.has(type)) {
      _activeFarmTypes.delete(type);
    } else {
      _activeFarmTypes.add(type);
    }
    // Remove "all" if any specific type is selected
    _activeFarmTypes.delete('all');
    // If nothing selected, fall back to "all"
    if (_activeFarmTypes.size === 0) _activeFarmTypes.add('all');
  }

  // Update pill visual state
  document.querySelectorAll('#page-farms .filter-pill[data-ftype]').forEach(p => {
    const t = p.dataset.ftype;
    p.classList.toggle('active', _activeFarmTypes.has(t));
  });

  // Sync advState (populate catGroups from active pill selections)
  if (_activeFarmTypes.has('all')) {
    advState.farms.verified = false; advState.farms.days88 = 'any'; advState.farms.catGroups = []; advState.farms.subcats = []; advState.farms.subSubcats = [];
  } else {
    const activePills = [..._activeFarmTypes];
    advState.farms.verified = activePills.includes('verified');
    const has88 = activePills.includes('88days');
    advState.farms.days88 = has88 ? 'yes' : 'any';
    // Map each non-attribute pill to its advCat group name
    advState.farms.catGroups = activePills
      .filter(t => t !== '88days' && t !== 'verified')
      .map(t => PILL_TO_ADV_CAT[t])
      .filter(v => v !== undefined && v !== '' && v !== '__88days__' && v !== '__verified__');
    // Remove duplicates (e.g. honey/poultry/mixed all map to Mixed & Specialty)
    advState.farms.catGroups = [...new Set(advState.farms.catGroups)];
    // Clear subcats when multiple categories are active
    if (advState.farms.catGroups.length !== 1) {
      advState.farms.subcats = [];
      advState.farms.subSubcats = [];
    }
  }
  updateAdvBadge('farms');

  applyFarmPillFilter();
}

function applyFarmPillFilter() {
  if (!farmMap) return;
  let filtered;
  if (_activeFarmTypes.has('all')) {
    filtered = allFarms;
  } else {
    // Split active types into category pills and attribute pills
    const attrTypes  = ['88days', 'verified']; // pills that are attributes (AND)
    const activeAttrs = [..._activeFarmTypes].filter(t => attrTypes.includes(t));
    const activeCats  = [..._activeFarmTypes].filter(t => !attrTypes.includes(t));

    filtered = allFarms.filter(f => {
      // Category match: farm must match ANY of the selected categories (OR)
      const catMatch = activeCats.length === 0 || activeCats.some(type => {
        const group = farmFilterGroups[type];
        if (group) return group.includes((f.farm_category_first||'').toLowerCase());
        return (f.farm_category_first||'').toLowerCase().includes(type);
      });

      // Attribute match: farm must match ALL selected attributes (AND)
      const attrMatch = activeAttrs.every(type => {
        if (type === '88days') return (f.eighty_eight_days||'').toLowerCase() === 'yes';
        if (type === 'verified') return !!(f.last_checked_by && f.last_checked_by.trim());
        return true;
      });

      return catMatch && attrMatch;
    });
  }
  currentFilteredFarms = filtered;
  renderFarmMarkers(filtered);
  renderFarmsList(filtered);
}

function toggleFarmsView() {
  _toggleMapListView({
    mapEl:   document.getElementById('farmsMapView'),
    listEl:  document.getElementById('farmsListView'),
    iconEl:  document.getElementById('toggleFarmsIcon'),
    labelEl: document.getElementById('toggleFarmsLabel'),
    modeRef: _farmsViewMode,
    onList:  () => renderFarmsList(currentFilteredFarms.length ? currentFilteredFarms : allFarms),
    onMap:   () => { if (farmMap) setTimeout(() => farmMap.invalidateSize(), 50); },
  });
  farmsViewMode = _farmsViewMode.value; // keep legacy var in sync
}

// ── SHARED LOCATE HELPER ──
const _locateMarkers = new WeakMap(); // map → current locate marker
function _locateOnMap(map, onSuccess) {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  showToast('Locating…');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (map) {
      // Remove previous locate marker if any
      const prev = _locateMarkers.get(map);
      if (prev) map.removeLayer(prev);
      map.flyTo([lat, lng], 16, {animate:true, duration:1.2});
      const marker = L.circleMarker([lat, lng], {radius:8, color:'#D4851A', fillColor:'#F5A623', fillOpacity:0.9, weight:2})
        .addTo(map).bindPopup('You are here').openPopup();
      _locateMarkers.set(map, marker);
    }
    if (onSuccess) onSuccess(lat, lng);
    showToast('Location found!');
  }, () => showToast('Could not get location'));
}

function locateUser() {
  if (farmsViewMode === 'list') toggleFarmsView();
  _locateOnMap(farmMap, null);
}
function locateDealUser()      { _locateOnMap(dealMap,      null); }
function locateCommunityUser() { _locateOnMap(communityMap, null); }

// ── FARM DETAIL ──
// ── Detail row builder helpers ──
// detailRow(icon, label, valueHtml) → full row HTML
function detailRow(icon, label, valueHtml) {
  return `<div class="detail-row">
    <div class="detail-row-icon"><i class="material-symbols-outlined">${icon}</i></div>
    <div class="detail-row-content">
      <div class="detail-row-label">${label}</div>
      <div class="detail-row-value">${valueHtml}</div>
    </div>
  </div>`;
}
function detailRowEmpty(icon, label, msg='Not listed') {
  return detailRow(icon, label, `<span class="u-text-muted">${msg}</span>`);
}
function detailRowLink(icon, label, href, display) {
  return detailRow(icon, label, `<a href="${href}" class="detail-link">${display}</a>`);
}

async function openFarmDetail(id) {
  const f = allFarms.find(x => x.id === id);
  if (!f) return;
  closePinCard();

  // Hide FABs
  document.getElementById('toggleFarmsFab').classList.remove('visible');
  document.getElementById('mainFab').style.display = 'none';
  currentFarmId = id;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-farm-detail').classList.add('active');

  const t     = (f.farm_category_first||'').toLowerCase();
  const emoji = farmEmoji[t]  || farmEmoji.default;
  const color = farmColors[t] || farmColors.default;
  const pay   = f.pay_per_hour_aud ? `<span class="badge pay">$${f.pay_per_hour_aud}/hr</span>` : '';
  const acc   = f.accommodation && f.accommodation.toLowerCase() === 'yes' ? `<span class="badge deal">Housing</span>` : '';
  const is88  = (f.eighty_eight_days||'').toLowerCase() === 'yes' ? `<span class="badge" style="background:#E6F1FB;color:#185FA5;">88 days eligible</span>` : '';

  const el = document.getElementById('farmDetailContent');
  // Sanitise URL schemes to prevent javascript: injection in href attributes
  const safeUrl  = (u) => (u && /^https?:\/\//i.test(u.trim())) ? u.trim() : null;
  const safePhone = (p) => (p && /^[\d\s+\-().]+$/.test(p.trim())) ? p.trim() : null;
  const safeEmail = (e) => (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) ? e.trim() : null;

  const fPhone   = safePhone(f.phone);
  const fEmail   = safeEmail(f.email);
  const fWebsite = safeUrl(f.website);

  el.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-emoji">${emoji}</div>
      <div class="detail-hero-name">
        <span class="detail-verified-wrap" id="detail-verified-wrap">
          ${escHTML(f.business_name)}
        </span>
      </div>
      <div class="detail-hero-sub">
        <i class="material-symbols-outlined">location_on</i>${escHTML(f.city||'')}${f.state_region?', '+escHTML(f.state_region):''} · ${escHTML(f.country||'')}
        <span id="detail-hero-stars" style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;"></span>
      </div>
      <div class="detail-badges">
        <span class="badge">${escHTML(f.farm_category_first||'Farm')}</span>${pay}${acc}${is88}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Details</div>
      ${f.pay_per_hour_aud ? detailRow('attach_money','Pay rate',`$${escHTML(String(f.pay_per_hour_aud))} AUD / hour`) : ''}
      ${f.accommodation ? detailRow('home','Accommodation',escHTML(f.accommodation)) : ''}
      ${f.season ? detailRow('calendar_today','Season',escHTML(f.season)) : detailRowEmpty('calendar_today','Season','Not specified')}
      ${fPhone  ? detailRowLink('call','Phone', `tel:${escHTML(fPhone)}`,escHTML(fPhone))          : detailRowEmpty('call','Phone')}
      ${fEmail  ? detailRowLink('mail','Email',  `mailto:${escHTML(fEmail)}`,escHTML(fEmail))       : detailRowEmpty('mail','Email')}
      ${fWebsite? detailRow('language','Website',`<a href="${escHTML(fWebsite)}" target="_blank" rel="noopener noreferrer" class="detail-link">${escHTML(fWebsite)}</a>`) : detailRowEmpty('language','Website')}
      ${f.notes ? detailRow('notes','Notes',escHTML(f.notes)) : ''}
    </div>

    ${f.latitude && f.longitude ? `<div class="detail-section"><div class="detail-section-title">Location</div><div class="detail-map-mini" id="farmMiniMap"></div></div>` : ''}
    <div style="height:30px;"></div>
  `;

  if (f.latitude && f.longitude) {
    setTimeout(() => {
      const lat = parseFloat(f.latitude), lng = parseFloat(f.longitude);
      const miniMap = L.map('farmMiniMap', {zoomControl:false, dragging:false, scrollWheelZoom:false, attributionControl:false});
      L.tileLayer(getTileUrl(), {maxZoom:19}).addTo(miniMap);
      miniMap.setView([lat, lng], 13);
      L.marker([lat, lng], {icon: makePin(emoji, color)}).addTo(miniMap);
    }, 100);
  }

  // Load reviews once, share result between review section and star display
  renderReviewSection(f.id, el).then(reviews => {
    const span = document.getElementById('detail-hero-stars');
    if (!span) return;
    if (!reviews.length) return; // no reviews → show nothing
    const avg = reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length;
    span.innerHTML = `<span style="font-size:12px;font-weight:700;color:var(--amber-dark);">${avg.toFixed(1)}</span>` + starsHTML(avg,'sm');
  });

  // Fetch fresh last_checked data for this farm (cache may be stale from map load)
  supaFetch('businesses', `id=eq.${encodeURIComponent(id)}&select=last_checked_by,last_checked_at&limit=1`)
    .then(rows => {
      if (!rows || !rows.length || !rows[0].last_checked_by) return;
      const wrap = document.getElementById('detail-verified-wrap');
      if (!wrap) return;
      // Update the cache so repeat opens don't need to re-fetch
      const cached = allFarms.find(x => x.id === id);
      if (cached) { cached.last_checked_by = rows[0].last_checked_by; cached.last_checked_at = rows[0].last_checked_at; }
      const safeName = escHTML(rows[0].last_checked_by);
      wrap.insertAdjacentHTML('beforeend',
        `<button class="detail-verified-badge" data-checked-at="${escHTML(rows[0].last_checked_at || '')}" onclick="showVerifiedPopup(this)"><i class="material-symbols-outlined icon-filled">check_circle</i>Verified</button><div class="detail-verified-popup"></div>`
      );
    })
    .catch(() => {}); // badge is non-critical
}

// ── VERIFIED BADGE POPUP ──
let _verifiedPopupTimer = null;
function showVerifiedPopup(btn) {
  const popup = btn.nextElementSibling;
  if (!popup) return;

  const isoDate = btn.dataset.checkedAt || '';

  const d = new Date(isoDate);
  const dateStr = isNaN(d) ? isoDate : d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  popup.textContent = `Last checked the ${dateStr}`;

  // Make visible but hidden to measure real dimensions
  popup.style.visibility = 'hidden';
  popup.style.opacity    = '1';
  popup.style.top        = '0';
  popup.style.left       = '0';

  const r      = btn.getBoundingClientRect();
  const popW   = popup.offsetWidth  || 160;
  const popH   = popup.offsetHeight || 32;
  const margin = 8;

  let left = r.left + r.width / 2 - popW / 2;
  let top  = r.bottom + margin;

  left = Math.max(margin, Math.min(left, window.innerWidth  - popW - margin));
  if (top + popH > window.innerHeight - margin) top = r.top - popH - margin;

  const arrowLeft = (r.left + r.width / 2) - left;
  popup.style.setProperty('--arrow-left', arrowLeft + 'px');
  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';

  // Now actually show it
  popup.style.visibility = '';
  popup.style.opacity    = '';
  popup.classList.add('show');

  clearTimeout(_verifiedPopupTimer);
  _verifiedPopupTimer = setTimeout(() => popup.classList.remove('show'), 2000);
}



function openEditFarm() {
  if (!currentUser) { openAuthGate('farms'); return; }
  const f = allFarms.find(x => x.id === currentFarmId);
  if (!f) return;

  // Pre-fill all fields with existing data
  document.getElementById('editFarmId').value      = f.id;
  document.getElementById('editFarmName').value    = f.business_name || '';
  document.getElementById('editFarmPay').value     = f.pay_per_hour_aud || '';
  // Pre-fill tristate selectors from live farm data
  const accomVal = (f.accommodation||'unknown').toLowerCase();
  pickTri('editFarmAccom',   ['yes','no'].includes(accomVal) ? accomVal : 'unknown');
  pickTri('editFarm88',      (f.eighty_eight_days||'unknown').toLowerCase());
  pickTri('editFarmOrganic', (f.organic||'unknown').toLowerCase());
  document.getElementById('editFarmSeason').value  = f.season || '';
  setSeasonMonths('editFarmSeasonMonths', f.season || '');
  document.getElementById('editFarmPhone').value   = f.phone || '';
  document.getElementById('editFarmEmail').value   = f.email || '';
  document.getElementById('editFarmWebsite').value = f.website || '';
  document.getElementById('editFarmNotes').value   = f.notes || '';

  // Pre-fill main category
  document.querySelectorAll('[data-efcat]').forEach(b => b.classList.remove('on'));
  const existingCat = f.farm_category_first || '';
  if (existingCat) {
    const catBtn = document.querySelector(`[data-efcat="${existingCat}"]`);
    if (catBtn) {
      catBtn.classList.add('on');
      _renderEditFarmSubtypePills(existingCat, f.farm_category_second || '');
    } else {
      document.getElementById('editFarmCategorySecondGroup').style.display = 'none';
    }
  } else {
    document.getElementById('editFarmCategorySecondGroup').style.display = 'none';
  }

  // Pre-fill Facebook link
  document.getElementById('editFarmFbLink').value = f.fb_link || '';

  // Pre-select 88 days
  const is88 = (f.eighty_eight_days||'').toLowerCase() === 'yes';


  const lat = parseFloat(f.latitude)  || -33.87;
  const lng = parseFloat(f.longitude) || 151.21;
  document.getElementById('editFarmLat').value = lat;
  document.getElementById('editFarmLng').value = lng;

  document.getElementById('editFarmModal').classList.add('open');
  setTimeout(() => initEditFarmMap(lat, lng), 350);
}

// ── Tristate form helper (Yes / Unknown / No) ──
// Sets the hidden input value and highlights the active button.
function pickTri(fieldId, val) {
  document.getElementById(fieldId).value = val;
  const group = document.getElementById(`trigroup-${fieldId}`);
  if (!group) return;
  group.querySelectorAll('.tri-btn').forEach(btn => {
    btn.classList.remove('selected-yes', 'selected-no', 'selected-unknown');
  });
  const idx = ['yes', 'unknown', 'no'].indexOf(val);
  if (idx !== -1) group.querySelectorAll('.tri-btn')[idx].classList.add('selected-' + val);
}

function toggleMonth(btn) {
  btn.classList.toggle('on');
  const grid = btn.closest('.month-grid');
  if (!grid) return;
  const hiddenId = grid.id === 'farmFieldSeasonMonths' ? 'farmFieldSeason' : 'editFarmSeason';
  const selected = [...grid.querySelectorAll('.month-btn.on')].map(b => b.dataset.m);
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = selected.join(', ');
}

function setSeasonMonths(gridId, seasonStr) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.querySelectorAll('.month-btn').forEach(btn => btn.classList.remove('on'));
  if (!seasonStr) return;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = seasonStr.split(/[,\u2013\-\/ ]+/).map(s => s.trim()).filter(Boolean);
  parts.forEach(p => {
    const m = months.find(mo => mo.toLowerCase() === p.toLowerCase().slice(0, 3));
    const btn = grid.querySelector(`[data-m="${m}"]`);
    if (m && btn) btn.classList.add('on');
  });
}


function handleEditFarmBackdrop(e) {
  if (e.target === document.getElementById('editFarmModal'))
    document.getElementById('editFarmModal').classList.remove('open');
}

async function submitFarmEdit() {
  const name = document.getElementById('editFarmName').value.trim();
  if (!name) { showToast('Please enter a farm name'); return; }

  const farmId = document.getElementById('editFarmId').value;
  const cachedFarm = allFarms ? allFarms.find(f => f.id === farmId) : null;

  const _pay     = document.getElementById('editFarmPay').value.trim();
  const _accom   = document.getElementById('editFarmAccom').value || 'unknown';
  const _88days  = document.getElementById('editFarm88').value || 'unknown';
  const _organic = document.getElementById('editFarmOrganic').value || 'unknown';
  const _season  = document.getElementById('editFarmSeason').value.trim();
  const _phone   = document.getElementById('editFarmPhone').value.trim();
  const _email   = document.getElementById('editFarmEmail').value.trim();
  const _website = document.getElementById('editFarmWebsite').value.trim();
  const _notes   = document.getElementById('editFarmNotes').value.trim();

  // Category & sub-type
  const _catEl     = document.querySelector('[data-efcat].on');
  const _category  = _catEl ? _catEl.dataset.efcat : null;
  const _cat2El    = document.querySelector('[data-efcat2].on');
  let   _category2 = _cat2El ? _cat2El.dataset.efcat2 : null;
  if (_category2 === 'Other Farm') {
    const customVal = (document.getElementById('editFarmCatSecondCustom')?.value || '').trim();
    if (customVal) _category2 = customVal;
  }

  // Facebook link
  const _fbLink = (document.getElementById('editFarmFbLink')?.value || '').trim();

  const payload = {
    type:                'farm',
    business_name:       name,
    // 'details' carries only the edit reference + freetext notes so the
    // approval trigger knows this is an edit and which row to update.
    details:             ['EDIT OF: ' + farmId, _notes ? 'NOTES: ' + _notes : ''].filter(Boolean).join('\n'),
    // Structured columns — read directly by the approval trigger
    farm_pay_per_hour:   parseFloat(_pay)  || null,
    farm_accommodation:  _accom,
    farm_season:         _season  || null,
    farm_phone:          _phone   || null,
    farm_email:          _email   || null,
    farm_website:        _website || null,
    farm_eighty_eight:   _88days,
    farm_organic:        _organic,
    farm_category:       _category || null,
    farm_category_second: _category2 || null,
    fb_link:             _fbLink   || null,
    latitude:            parseFloat(document.getElementById('editFarmLat').value) || (cachedFarm ? cachedFarm.latitude  : null),
    longitude:           parseFloat(document.getElementById('editFarmLng').value) || (cachedFarm ? cachedFarm.longitude : null),
    country:             cachedFarm ? cachedFarm.country      : null,
    state_region:        cachedFarm ? cachedFarm.state_region : null,
    city:                cachedFarm ? cachedFarm.city         : null,
    address:             cachedFarm ? cachedFarm.address      : null,
    admin_decision:      'pending',
    target_id:           farmId || null,
    submitted_by_email:  currentUser?.email || null,
    // submitted_by_email already captures the checker identity; submission_date is set by the DB
  };

  try {
    await supaInsert('submissions', payload);
    // Optimistically update the in-memory farm so the badge reflects this submission immediately
    if (cachedFarm) {
      // Badge will refresh from submissions table on next openFarmDetail
    }
    document.getElementById('editFarmModal').classList.remove('open');
    setTimeout(() => showToast('Edit submitted — thanks! 🐝'), 300);
  } catch(e) {
    if (e?.message === 'Please sign in to submit.') { openAuthGate('farms'); return; }
    showToast('Error sending — please try again');
  }
}


