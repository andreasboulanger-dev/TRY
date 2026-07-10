// ╔═══════════════════════════════════════════════════════════╗
// ║  PRICE DISPLAY — Active Prices, Happy Hour Rendering     ║
// ╚═══════════════════════════════════════════════════════════╝

// ── ACTIVE PRICE LOGIC ──
function parseJSONSafe(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch(e) { return null; }
}

// Helper: normalise item_scopes (new) vs item_scope string (legacy)
function getScopes(obj) {
  if (!obj) return [];
  return obj.item_scopes || (obj.item_scope ? [obj.item_scope] : []);
}

// to12h() moved to utils.js — now also shared by the opening-hours widget.

function getActiveHH(item) {
  const slots = parseJSONSafe(item.happy_hour_prices);
  if (!slots || !Array.isArray(slots)) return null;
  const now = new Date();
  const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const slot of slots) {
    const scopes = getScopes(slot);
    if (scopes.length && item.item_name && !scopes.includes(item.item_name)) continue;
    if (!slot.days || !slot.days.includes(dayKey)) continue;
    const [fh,fm] = slot.from.split(':').map(Number);
    const [th,tm] = slot.to.split(':').map(Number);
    if (nowMins >= fh*60+fm && nowMins <= th*60+tm) return parseFloat(slot.price);
  }
  return null;
}

function getLDPrice(item) {
  const ld = parseJSONSafe(item.local_discount);
  if (!ld || !item.price_normal) return null;
  const scopes = getScopes(ld);
  if (scopes.length && item.item_name && !scopes.includes(item.item_name)) return null;
  return ld.type === 'percent'
    ? parseFloat(item.price_normal) * (1 - ld.value / 100)
    : parseFloat(ld.value);
}

function getLowestPrice(item) {
  const normal = parseFloat(item.price_normal) || null;
  const hh     = getActiveHH(item);
  const ld     = getLDPrice(item);
  const candidates = [normal, hh, ld].filter(v => v !== null && v > 0);
  return candidates.length ? Math.min(...candidates) : null;
}

function isItemVisible(item) {
  // Has normal price → always visible
  if (item.price_normal && parseFloat(item.price_normal) > 0) return true;
  // Only HH prices → visible only during active HH
  if (item.happy_hour_prices) return getActiveHH(item) !== null;
  return false;
}

function initPickerMap() {
  if (pickerMap) {
    // Map already exists — just resize and re-center on current location for a fresh session
    pickerMap.invalidateSize();
    getUserLocation().then(pos => {
      if (!pos) return;
      const ll = L.latLng(pos.lat, pos.lng);
      pickerMarker.setLatLng(ll);
      pickerMap.setView(ll, 13);
      updatePickerCoords();
    });
    return;
  }
  window.pickerMap = pickerMap = L.map('pickerMap', {center:[-30,147], zoom:3, zoomControl:false, attributionControl:false});
  L.tileLayer(TILE_URL, {maxZoom:19}).addTo(pickerMap);
  pickerMarker = L.marker([-30,147], {draggable:true, icon:makePin('📍','#D4851A',40)}).addTo(pickerMap);
  pickerMarker.on('dragend', updatePickerCoords);
  pickerMap.on('click', e => { pickerMarker.setLatLng(e.latlng); updatePickerCoords(); });
  getUserLocation().then(pos => {
    if (pos) {
      const ll = L.latLng(pos.lat, pos.lng);
      pickerMarker.setLatLng(ll);
      pickerMap.setView(ll, 13);
      updatePickerCoords();
    }
  });
  updatePickerCoords();
}

let pickerSearchDebounce = null;

function onPickerSearch(val) {
  const clear = document.getElementById('pickerSearchClear');
  const results = document.getElementById('pickerSearchResults');
  clear.classList.toggle('visible', val.length > 0);
  clearTimeout(pickerSearchDebounce);
  if (val.trim().length < 2) { results.classList.remove('open'); results.innerHTML = ''; return; }
  results.classList.add('open');
  results.innerHTML = '<div class="picker-search-result"><span>Searching…</span></div>';
  pickerSearchDebounce = setTimeout(() => runPickerSearch(val.trim()), 450);
}

async function runPickerSearch(q) {
  const results = document.getElementById('pickerSearchResults');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'TheHiveApp/1.0' }
    });
    const data = await res.json();
    if (!data.length) {
      results.innerHTML = '<div class="picker-search-result"><span>No results found</span></div>';
      return;
    }
    // Store results so onclick can reference by index — avoids serialising display_name
    // (which may contain apostrophes / HTML characters) into an attribute string.
    window._pickerSearchResults = data;
    results.innerHTML = data.map((r, i) => {
      const parts = r.display_name.split(', ');
      const name = escHTML(parts.slice(0, 2).join(', '));
      const rest = escHTML(parts.slice(2).join(', '));
      return `<div class="picker-search-result" onclick="pickSearchResultByIndex(${i})">
        <strong>${name}</strong><br><span>${rest}</span>
      </div>`;
    }).join('');
  } catch(e) {
    results.innerHTML = '<div class="picker-search-result"><span>Search unavailable — drag the pin manually</span></div>';
  }
}

async function pickSearchResult(lat, lon, label) {
  const latlng = L.latLng(parseFloat(lat), parseFloat(lon));
  if (!pickerMap) { initPickerMap(); setTimeout(() => { pickerMarker.setLatLng(latlng); pickerMap.flyTo(latlng, 15); updatePickerCoords(); }, 400); }
  else { pickerMarker.setLatLng(latlng); pickerMap.flyTo(latlng, 15, {animate:true, duration:1}); updatePickerCoords(); }
  document.getElementById('pickerSearchInput').value = label.split(',').slice(0,2).join(',');
  document.getElementById('pickerSearchResults').classList.remove('open');
  document.getElementById('pickerSearchClear').classList.add('visible');

  // Auto-fill establishment name from the selected address
  const nameField = document.getElementById('fieldName');
  if (nameField && !nameField.value.trim()) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheHiveApp/1.0' } });
      const data = await res.json();
      const a = data.address || {};
      const suggested = a.amenity || a.shop || a.tourism || a.leisure || a.building || '';
      if (suggested) nameField.value = suggested;
    } catch(e) {}
  }
}

// Index-based wrapper — avoids embedding display_name (third-party, may contain HTML chars)
// directly into an onclick attribute string.
function pickSearchResultByIndex(i) {
  const r = window._pickerSearchResults && window._pickerSearchResults[i];
  if (!r) return;
  pickSearchResult(r.lat, r.lon, r.display_name);
}

// ── SHARED UTILITIES ──
function getInitials(name) {
  return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
}

function _clearPickerSearch(inputId, clearId, resultsId) {
  document.getElementById(inputId).value = '';
  document.getElementById(clearId).classList.remove('visible');
  document.getElementById(resultsId).classList.remove('open');
  document.getElementById(resultsId).innerHTML = '';
}

function clearPickerSearch()    { _clearPickerSearch('pickerSearchInput',   'pickerSearchClear',   'pickerSearchResults');   }
function clearEditLPSearch()    { _clearPickerSearch('editLPSearchInput',   'editLPSearchClear',   'editLPSearchResults');   }
function clearEditFarmSearch()  { _clearPickerSearch('editFarmSearchInput', 'editFarmSearchClear', 'editFarmSearchResults'); }

// Close results on outside click
document.addEventListener('click', e => {
  const wrap = document.querySelector('.picker-search-wrap');
  if (wrap && !wrap.contains(e.target)) document.getElementById('pickerSearchResults')?.classList.remove('open');
});

function locateOnPicker() {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  showToast('Locating…');
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    pickerMarker.setLatLng(latlng);
    pickerMap.flyTo(latlng, 13, {animate:true, duration:1});
    updatePickerCoords();
    showToast('Location set!');
  }, () => {
    showToast('Could not get location');
  });
}

function updatePickerCoords() {
  const ll = pickerMarker.getLatLng();
  pickerLat = ll.lat.toFixed(5);
  pickerLng = ll.lng.toFixed(5);
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheHiveApp/1.0' } }
    );
    const data = await res.json();
    const a = data.address || {};
    return {
      country:      a.country      || null,
      state_region: a.state        || a.region       || a.province || null,
      city:         a.city         || a.town          || a.village  || a.suburb || null,
      address:      data.display_name || null
    };
  } catch(e) {
    console.warn('Reverse geocode failed:', e);
    return { country: null, state_region: null, city: null, address: null };
  }
}

async function submitForm() {
  const typeEl = document.querySelector('.type-option.selected');
  const type   = (typeEl ? typeEl.dataset.type : null) || lockedType;
  const name   = document.getElementById('fieldName').value.trim();
  const details= document.getElementById('fieldDetails').value.trim();

  if (!type)  { showToast('Please select a type'); return; }
  if (!name)  { showToast('Please enter the establishment name'); return; }
  if (!pickerLat) { showToast('Please move the pin to set a location'); return; }

  // Loading state
  const btn = document.getElementById('submitFormBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite;display:inline-block;"></i> Sending…'; }



  // Reverse geocode the pin location
  showToast('Locating…');
  const geo = await reverseGeocode(pickerLat, pickerLng);

  try {
    if (type === 'price') {
      const catEl = document.querySelector('[data-pcat].selected');
      if (!catEl) { showToast('Please select a category'); return; }
      const priceCategory = catEl.dataset.pcat;

      const rows = document.querySelectorAll('.price-row');
      let addedCount = 0;

      // ── Clear previous error banners ──
      document.querySelectorAll('.validation-error-banner').forEach(el => el.remove());

      // ── Validate price items (price, duplicates, outliers) ──
      const rowErr = validatePriceRows([...rows]);
      if (rowErr) {
        showValidationError(rowErr);
        if (btn) { btn.disabled = false; btn.innerHTML = 'Send for review'; }
        return;
      }

      // ── Validate Happy Hour slots ──
      const hhSlotEls = [...document.querySelectorAll('#hhSlots .hh-slot')];
      if (hhSlotEls.length > 0) {
        const hhErr = validateHHSlots(hhSlotEls, [...rows]);
        if (hhErr) {
          showValidationError(hhErr);
          if (btn) { btn.disabled = false; btn.innerHTML = 'Send for review'; }
          return;
        }
      }

      // ── Validate Local Discount ──
      const ldValueEl = document.getElementById('ldValue');
      const itemsMapForLD = new Map();
      [...rows].forEach(row => {
        const n = row.querySelector('.item-name')?.value.trim();
        const p = parseFloat(row.querySelector('.item-price')?.value);
        if (n && !isNaN(p) && p > 0) itemsMapForLD.set(n, p);
      });
      const ldErr = validateLDData(ldType, ldValueEl, itemsMapForLD);
      if (ldErr) {
        showValidationError(ldErr);
        if (btn) { btn.disabled = false; btn.innerHTML = 'Send for review'; }
        return;
      }

      // Multi-item submissions (e.g. Heineken + Corona added together) share
      // one batch_id so admins can review/approve/reject the whole group in
      // one action instead of N separate ungrouped rows. Single-item
      // submissions stay batch_id: null — no grouping needed for one row.
      const validItemRows = [...rows]
        .map(row => ({
          itemName:  row.querySelector('.item-name').value.trim(),
          itemPrice: parseFloat(row.querySelector('.item-price').value),
        }))
        .filter(r => r.itemName && !isNaN(r.itemPrice));
      const batchId = validItemRows.length > 1 ? crypto.randomUUID() : null;

      for (const { itemName, itemPrice } of validItemRows) {
        const hhData = getHHData();
        const ldData = getLDData();
        const payload = {
          type,
          business_name:        name,
          item_category:        priceCategory,
          latitude:             parseFloat(pickerLat),
          longitude:            parseFloat(pickerLng),
          country:              geo.country,
          state_region:         geo.state_region,
          city:                 geo.city,
          address:              geo.address,
          item_name:            itemName,
          item_price:           itemPrice,
          happy_hour_prices:    hhData || null,
          local_discount:       ldData || null,
          batch_id:             batchId,
        };
        await supaInsert('submissions', payload);
        addedCount++;
      }

      if (addedCount === 0) {
        showToast('Please add at least one valid item and price');
        return;
      }

    } else {
      const payload = {
        type,
        business_name: name,
        details,
        latitude:      parseFloat(pickerLat),
        longitude:     parseFloat(pickerLng),
        country:       geo.country,
        state_region:  geo.state_region,
        city:          geo.city,
        address:       geo.address,
      };
      // Farm-specific fields stored in dedicated columns (read by approval trigger)
      if (type === 'farm') {
        const phone   = document.getElementById('farmFieldPhone').value.trim();
        const email   = document.getElementById('farmFieldEmail').value.trim();
        const website = document.getElementById('farmFieldWebsite').value.trim();
        const pay     = document.getElementById('farmFieldPay').value.trim();
        const accom   = document.getElementById('farmFieldAccom').value || 'unknown';
        const f88     = document.getElementById('farmField88').value || 'unknown';
        const organic = document.getElementById('farmFieldOrganic').value || 'unknown';
        const season  = document.getElementById('farmFieldSeason').value.trim();
        // Main category — required
        const catEl = document.querySelector('[data-fcat].on');
        if (!catEl) {
          showValidationError('Please select a main category for the farm.');
          if (btn) { btn.disabled = false; btn.innerHTML = 'Send for review'; }
          return;
        }
        // Optional sub-type — use custom text if "Other Farm" was picked
        const catSecondEl = document.querySelector('[data-fcat2].on');
        let catSecondValue = catSecondEl ? catSecondEl.dataset.fcat2 : null;
        if (catSecondValue === 'Other Farm') {
          const customVal = (document.getElementById('farmCatSecondCustom')?.value || '').trim();
          if (customVal) catSecondValue = customVal;
        }
        payload.farm_category        = catEl.dataset.fcat;
        payload.farm_category_second = catSecondValue || null;
        payload.farm_phone         = phone   || null;
        payload.farm_email         = email   || null;
        payload.farm_website       = website || null;
        payload.farm_pay_per_hour  = parseFloat(pay) || null;
        payload.farm_accommodation = accom;
        payload.farm_season        = season  || null;
        payload.farm_eighty_eight  = f88;
        payload.farm_organic       = organic;
        // Facebook link (optional)
        const fbLink = (document.getElementById('fieldFbLink')?.value || '').trim();
        if (fbLink) payload.fb_link = fbLink;
      }
      await supaInsert('submissions', payload);
    }

    closeSubmit();
    setTimeout(() => showToast('Sent! We\'ll review your submission soon.'), 300);
  } catch(e) {
    console.error('Submit error:', e);
    if (e?.message === 'Please sign in to submit.') { closeSubmit(); openAuthGate(currentPage); return; }
    showToast('Error: ' + (e.message ? e.message.slice(0,60) : 'please try again'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Send for review'; }
  }
}



