// ╔═══════════════════════════════════════════════════════════╗
// ║  DEALS & LOCAL PRICES — Map, Detail, Edit, Submission   ║
// ╚═══════════════════════════════════════════════════════════╝

let currentLocalPriceKey = null;

let editLDType = 'none';

function selectEditLPCat(el) {
  document.querySelectorAll('[data-lpcat]').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function setEditLDType(type) {
  editLDType = type;
  ['Percent','Fixed','None'].forEach(t => {
    const btn = document.getElementById('editLDType'+t);
    if (btn) btn.classList.toggle('active', t.toLowerCase()===type);
  });
  const row = document.getElementById('editLDValueRow');
  row.style.display = (type === 'none') ? 'none' : '';
  document.getElementById('editLDValue').placeholder = type === 'percent' ? 'e.g. 20 (for 20% off)' : 'e.g. 9.50 (fixed price)';
  if (type !== 'none') {
    let wrap = document.getElementById('editLDItemScopeWrap');
    if (!wrap) {
      const names = getItemNamesFromForm('#editLPRows');
      const pillHtml = buildItemScopePills(names, [], 'hh-item-scope-wrap').replace('<div class="hh-item-scope-wrap','<div id="editLDItemScopeWrap" class="hh-item-scope-wrap');
      const block = document.createElement('div');
      block.id = 'editLDScopeBlock';
      block.innerHTML = `<label style="font-size:11px;font-weight:600;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;display:block;margin:8px 0 4px;">Applies to</label>${pillHtml}`;
      row.appendChild(block);
    } else {
      refreshEditItemScopePills();
    }
  }
}

function addEditLPHHSlot() {
  const container = document.getElementById('editLPHHSlots');
  const names = getItemNamesFromForm('#editLPRows');
  const div = document.createElement('div');
  div.className = 'hh-slot';
  div.innerHTML = `
    <div class="hh-day-row">${HH_DAYS.map(d=>`<button type="button" class="hh-day-btn on" data-day="${d}" onclick="toggleHHDay(this)">${d}</button>`).join('')}</div>
    <div class="hh-time-row">
      <input type="time" class="form-input hh-from" value="17:00">
      <span style="text-align:center;color:var(--text-light);font-size:12px;">to</span>
      <input type="time" class="form-input hh-to" value="19:00">
      <button type="button" class="remove-hh-btn" onclick="this.closest('.hh-slot').remove()"><i class="material-symbols-outlined">close</i></button>
    </div>
    <div style="margin-bottom:6px;">
      <input type="number" class="form-input hh-price" placeholder="Happy hour price ($)" step="0.01" min="0">
    </div>
    <div style="margin-bottom:10px;">
      <label style="font-size:11px;font-weight:600;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Applies to</label>
      ${buildItemScopePills(names, [], 'hh-item-scope-wrap')}
    </div>`;
  container.appendChild(div);
}

function getEditHHData() {
  const slots = [];
  document.querySelectorAll('#editLPHHSlots .hh-slot').forEach(slot => {
    const days = [...slot.querySelectorAll('.hh-day-btn.on:not(.scope-all-btn):not(.scope-item-btn)')].map(b => b.dataset.day.toLowerCase());
    const from  = slot.querySelector('.hh-from').value;
    const to    = slot.querySelector('.hh-to').value;
    const price = parseFloat(slot.querySelector('.hh-price').value);
    const wrap  = slot.querySelector('.hh-item-scope-wrap');
    const item_scopes = getScopeFromWrap(wrap);
    if (days.length && from && to && !isNaN(price) && price > 0) {
      slots.push({ price, days, from, to, ...(item_scopes.length ? {item_scopes} : {}) });
    }
  });
  return slots.length ? slots : null;
}

function getEditLDData() {
  if (editLDType === 'none') return null;
  const val = parseFloat(document.getElementById('editLDValue').value);
  if (isNaN(val) || val <= 0) return null;
  const wrap = document.getElementById('editLDItemScopeWrap');
  const item_scopes = getScopeFromWrap(wrap);
  return { type: editLDType, value: val, ...(item_scopes.length ? {item_scopes} : {}) };
}

let editLPMap = null, editLPMarker = null;
let editFarmMapInst = null, editFarmMarker = null;
let editLPSearchDebounce = null, editFarmSearchDebounce = null;

function initEditLPMap(lat, lng) {
  // Always destroy and recreate to avoid blank tiles after modal close/reopen
  if (editLPMap) {
    try { editLPMap.remove(); } catch(e) {}
    editLPMap = null;
    editLPMarker = null;
  }
  const el = document.getElementById('editLPMap');
  if (!el) return;
  editLPMap = L.map(el, {center:[lat,lng], zoom:15, zoomControl:false, attributionControl:false});
  L.tileLayer(getTileUrl(), {maxZoom:19}).addTo(editLPMap);
  editLPMarker = L.marker([lat,lng], {draggable:true, icon:makePin('📍','#D4851A')}).addTo(editLPMap);
  editLPMarker.on('dragend', () => {
    const ll = editLPMarker.getLatLng();
    document.getElementById('editLPLat').value = ll.lat.toFixed(5);
    document.getElementById('editLPLng').value = ll.lng.toFixed(5);
  });
  editLPMap.on('click', e => {
    editLPMarker.setLatLng(e.latlng);
    document.getElementById('editLPLat').value = e.latlng.lat.toFixed(5);
    document.getElementById('editLPLng').value = e.latlng.lng.toFixed(5);
  });
  setTimeout(() => editLPMap && editLPMap.invalidateSize(), 100);
  setTimeout(() => editLPMap && editLPMap.invalidateSize(), 500);
}


function initEditFarmMap(lat, lng) {
  if (editFarmMapInst) {
    editFarmMapInst.setView([lat, lng], 13);
    editFarmMarker.setLatLng([lat, lng]);
    editFarmMapInst.invalidateSize();
    return;
  }
  editFarmMapInst = L.map('editFarmMap', {center:[lat,lng], zoom:13, zoomControl:false, attributionControl:false});
  L.tileLayer(getTileUrl(), {maxZoom:19}).addTo(editFarmMapInst);
  editFarmMarker = L.marker([lat,lng], {draggable:true, icon:makePin('📍','#D4851A',36)}).addTo(editFarmMapInst);
  editFarmMarker.on('dragend', () => {
    const ll = editFarmMarker.getLatLng();
    document.getElementById('editFarmLat').value = ll.lat.toFixed(5);
    document.getElementById('editFarmLng').value = ll.lng.toFixed(5);
  });
  editFarmMapInst.on('click', e => {
    editFarmMarker.setLatLng(e.latlng);
    document.getElementById('editFarmLat').value = e.latlng.lat.toFixed(5);
    document.getElementById('editFarmLng').value = e.latlng.lng.toFixed(5);
  });
  setTimeout(() => editFarmMapInst.invalidateSize(), 300);
}

// Search for edit LP map
function onEditLPSearch(val) {
  clearTimeout(editLPSearchDebounce);
  const results = document.getElementById('editLPSearchResults');
  document.getElementById('editLPSearchClear').classList.toggle('visible', val.length > 0);
  if (val.trim().length < 2) { results.classList.remove('open'); return; }
  editLPSearchDebounce = setTimeout(() => runEditSearch(val.trim(), 'editLPSearchResults', (lat, lon, label) => {
    editLPMarker.setLatLng([lat, lon]);
    editLPMap.flyTo([lat, lon], 16, {animate:true, duration:1});
    document.getElementById('editLPLat').value = parseFloat(lat).toFixed(5);
    document.getElementById('editLPLng').value = parseFloat(lon).toFixed(5);
    document.getElementById('editLPSearchInput').value = label.split(',').slice(0,2).join(',');
    document.getElementById('editLPSearchResults').classList.remove('open');
    document.getElementById('editLPSearchClear').classList.add('visible');
  }), 450);
}



// Search for edit Farm map
function onEditFarmSearch(val) {
  clearTimeout(editFarmSearchDebounce);
  const results = document.getElementById('editFarmSearchResults');
  document.getElementById('editFarmSearchClear').classList.toggle('visible', val.length > 0);
  if (val.trim().length < 2) { results.classList.remove('open'); return; }
  editFarmSearchDebounce = setTimeout(() => runEditSearch(val.trim(), 'editFarmSearchResults', (lat, lon, label) => {
    editFarmMarker.setLatLng([lat, lon]);
    editFarmMapInst.flyTo([lat, lon], 14, {animate:true, duration:1});
    document.getElementById('editFarmLat').value = parseFloat(lat).toFixed(5);
    document.getElementById('editFarmLng').value = parseFloat(lon).toFixed(5);
    document.getElementById('editFarmSearchInput').value = label.split(',').slice(0,2).join(',');
    document.getElementById('editFarmSearchResults').classList.remove('open');
    document.getElementById('editFarmSearchClear').classList.add('visible');
  }), 450);
}



// Shared search runner for edit maps
async function runEditSearch(query, resultsId, onSelect) {
  const results = document.getElementById(resultsId);
  results.innerHTML = '<div class="picker-search-result"><span>Searching…</span></div>';
  results.classList.add('open');
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`, { headers: {'Accept-Language':'en','User-Agent':'TheHiveApp/1.0'} });
    const data = await r.json();
    if (!data.length) { results.innerHTML = '<div class="picker-search-result"><span>No results found</span></div>'; return; }
    // Store results + callback so onclick can reference by index (avoids toString() serialisation
    // which breaks on apostrophes in place names and minified variable names)
    window._editSearchResults = data;
    window._editSearchCallback = onSelect;
    results.innerHTML = data.map((item, i) => {
      const parts = item.display_name.split(',');
      const name = escHTML(parts[0].trim());
      const rest = escHTML(parts.slice(1,3).join(',').trim());
      return `<div class="picker-search-result" onclick="pickEditResult(${i})"><strong>${name}</strong><br><span>${rest}</span></div>`;
    }).join('');
  } catch(e) {
    results.innerHTML = '<div class="picker-search-result"><span>Search unavailable</span></div>';
  }
}

function pickEditResult(i) {
  const item = window._editSearchResults && window._editSearchResults[i];
  if (!item || typeof window._editSearchCallback !== 'function') return;
  window._editSearchCallback(item.lat, item.lon, item.display_name);
}

function closeEditLocalPrice() {
  document.getElementById('editLocalPriceModal').classList.remove('open');
  document.getElementById('editLPHHSlots').innerHTML = '';
  document.getElementById('editLPSearchInput').value = '';
  document.getElementById('editLPSearchClear').classList.remove('visible');
  document.getElementById('editLPSearchResults').classList.remove('open');
  editLDType = 'none';
  ['Percent','Fixed','None'].forEach(t => {
    const btn = document.getElementById('editLDType'+t);
    if (btn) btn.classList.toggle('active', t==='None');
  });
  const ldValRow = document.getElementById('editLDValueRow');
  if (ldValRow) ldValRow.style.display = 'none';
  const ldVal = document.getElementById('editLDValue');
  if (ldVal) ldVal.value = '';
  // Remove dynamically injected scope block
  const scopeBlock = document.getElementById('editLDScopeBlock');
  if (scopeBlock) scopeBlock.remove();
}

function openEditLocalPrice() {
  if (!currentUser) { openAuthGate('deals'); return; }
  const group = priceGroupsCache[currentLocalPriceKey];
  if (!group) { console.warn('[Edit] group not found for key:', currentLocalPriceKey); return; }
  const { p, cat, items } = group;

  try {
    document.getElementById('editLocalPriceKey').value = currentLocalPriceKey;
    document.getElementById('editLPName').value = p.business_name || '';
    document.getElementById('editLPNotes').value = '';

    document.querySelectorAll('[data-lpcat]').forEach(b => {
      b.classList.toggle('selected', b.dataset.lpcat === cat);
    });

    const container = document.getElementById('editLPRows');
    container.innerHTML = items.map(i => `
      <div class="price-row">
        <input type="text" class="form-input item-name" placeholder="Item" value="${escHTML(i.item_name||'')}" oninput="refreshEditItemScopeDropdowns()">
        <input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01" value="${escHTML(String(i.price_normal||''))}">
      </div>`).join('');

    const hhItem = items.find(i => i.happy_hour_prices);
    const hhSlots = document.getElementById('editLPHHSlots');
    hhSlots.innerHTML = '';
    if (hhItem) {
      const hhParsed = parseJSONSafe(hhItem.happy_hour_prices);
      if (Array.isArray(hhParsed)) {
        hhParsed.forEach(slot => {
          addEditLPHHSlot();
          const last = hhSlots.lastElementChild;
          const days = Array.isArray(slot.days) ? slot.days : [];
          last.querySelectorAll('.hh-day-btn').forEach(b => {
            b.classList.toggle('on', days.includes(b.dataset.day.toLowerCase()));
          });
          last.querySelector('.hh-from').value = slot.from || '17:00';
          last.querySelector('.hh-to').value   = slot.to   || '19:00';
          last.querySelector('.hh-price').value = slot.price || '';
          const scopeSel = last.querySelector('.hh-item-scope-wrap');
          if (scopeSel && (slot.item_scopes || slot.item_scope)) {
            const scopes = getScopes(slot);
            refreshEditItemScopePills();
            scopeSel.querySelectorAll('.scope-item-btn').forEach(b => {
              b.classList.toggle('on', scopes.includes(b.dataset.item));
            });
            if (scopes.length) scopeSel.querySelector('.scope-all-btn')?.classList.remove('on');
          }
        });
      }
    }

    const ldItem = items.find(i => i.local_discount);
    const ldParsed = ldItem ? parseJSONSafe(ldItem.local_discount) : null;
    if (ldParsed) {
      setEditLDType(ldParsed.type || 'none');
      document.getElementById('editLDValue').value = ldParsed.value || '';
      if (ldParsed.item_scopes || ldParsed.item_scope) {
        const scopes = getScopes(ldParsed);
        refreshEditItemScopePills();
        const ldWrap = document.getElementById('editLDItemScopeWrap');
        if (ldWrap) {
          ldWrap.querySelectorAll('.scope-item-btn').forEach(b => {
            b.classList.toggle('on', scopes.includes(b.dataset.item));
          });
          if (scopes.length) ldWrap.querySelector('.scope-all-btn')?.classList.remove('on');
        }
      }
    } else {
      setEditLDType('none');
    }
  } catch(err) {
    console.error('[Edit] form fill error:', err);
  }

  const lat = parseFloat(p.latitude)  || -45.03;
  const lng = parseFloat(p.longitude) || 168.66;
  document.getElementById('editLPLat').value = lat;
  document.getElementById('editLPLng').value = lng;

  document.getElementById('editLocalPriceModal').classList.add('open');
  setTimeout(() => initEditLPMap(lat, lng), 350);
}

function addEditLPRow() {
  const container = document.getElementById('editLPRows');
  const row = document.createElement('div');
  row.className = 'price-row';
  row.innerHTML = `
    <input type="text" class="form-input item-name" placeholder="e.g. Pint of beer" oninput="refreshEditItemScopeDropdowns()">
    <input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01">`;
  container.appendChild(row);
  refreshEditItemScopeDropdowns();
}

async function submitLocalPriceEdit() {
  const name = document.getElementById('editLPName').value.trim();
  if (!name) { showToast('Please enter a business name'); return; }

  const catEl = document.querySelector('[data-lpcat].selected');
  if (!catEl) { showToast('Please select a category'); return; }

  const rows = document.querySelectorAll('#editLPRows .price-row');

  // ── Clear previous error banners ──
  document.querySelectorAll('.validation-error-banner').forEach(el => el.remove());

  // ── Validate price items ──
  const rowErr = validatePriceRows([...rows]);
  if (rowErr) { showValidationError(rowErr); return; }

  // ── Validate Happy Hour slots ──
  const editHHSlotEls = [...document.querySelectorAll('#editLPHHSlots .hh-slot')];
  if (editHHSlotEls.length > 0) {
    const hhErr = validateHHSlots(editHHSlotEls, [...rows]);
    if (hhErr) { showValidationError(hhErr); return; }
  }

  // ── Validate Local Discount ──
  const editLDValueEl = document.getElementById('editLDValue');
  const editItemsMap = new Map();
  [...rows].forEach(row => {
    const n = row.querySelector('.item-name')?.value.trim();
    const p = parseFloat(row.querySelector('.item-price')?.value);
    if (n && !isNaN(p) && p > 0) editItemsMap.set(n, p);
  });
  const ldErr = validateLDData(editLDType, editLDValueEl, editItemsMap);
  if (ldErr) { showValidationError(ldErr); return; }

  const hhData = getEditHHData();
  const ldData = getEditLDData();
  const notes  = document.getElementById('editLPNotes').value.trim();
  const editRef = document.getElementById('editLocalPriceKey').value;

  // Use updated lat/lng from map picker (falls back to cached values)
  const group = priceGroupsCache[editRef];
  const lat = parseFloat(document.getElementById('editLPLat').value) || (group ? parseFloat(group.p.latitude) : null);
  const lng = parseFloat(document.getElementById('editLPLng').value) || (group ? parseFloat(group.p.longitude) : null);
  // Re-geocode if location changed
  let country = group ? group.p.country : null;
  let state_region = group ? group.p.state_region : null;
  let city = group ? group.p.city : null;
  let address = group ? group.p.address : null;
  const origLat = group ? parseFloat(group.p.latitude) : null;
  const origLng = group ? parseFloat(group.p.longitude) : null;
  if (lat && lng && (Math.abs(lat - origLat) > 0.0001 || Math.abs(lng - origLng) > 0.0001)) {
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {headers:{'Accept-Language':'en','User-Agent':'TheHiveApp/1.0'}});
      const geoData = await geoRes.json();
      const a = geoData.address || {};
      country      = a.country || country;
      state_region = a.state || a.region || state_region;
      city         = a.city || a.town || a.village || city;
      address      = geoData.display_name || address;
    } catch(e) {}
  }

  // One submission per item — same as main form.
  // Build a name→id map from the cached group so each submission carries the
  // exact local_prices row ID as target_id — enables the ID-based trigger path.
  const itemIdMap = {};
  if (group && group.items) {
    group.items.forEach(i => { if (i.item_name && i.id) itemIdMap[i.item_name.trim()] = i.id; });
  }

  const validRows = [...rows].map(r => ({
    itemName:  r.querySelector('.item-name').value.trim(),
    itemPrice: parseFloat(r.querySelector('.item-price').value)
  })).filter(r => r.itemName && !isNaN(r.itemPrice) && r.itemPrice > 0);

  if (!validRows.length) { showToast('Please add at least one valid item and price'); return; }

  // Multi-item edits share one batch_id, same as new multi-item submissions —
  // lets admins review/approve/reject the whole group in one action.
  const editBatchId = validRows.length > 1 ? crypto.randomUUID() : null;

  try {
    for (const row of validRows) {
      const payload = {
        type:              'price',
        business_name:     name,
        item_category:     catEl.dataset.lpcat,
        item_name:         row.itemName,
        item_price:        row.itemPrice,
        happy_hour_prices: hhData || null,
        local_discount:    ldData || null,
        details:           ['EDIT OF: ' + editRef, notes ? 'NOTES: ' + notes : ''].filter(Boolean).join('\n'),
        // ID-based match: target_id is the actual local_prices.id for this item.
        // Falls back to null for newly added items (no existing row to update → INSERT path).
        target_id:         itemIdMap[row.itemName] || null,
        latitude:          lat,
        longitude:         lng,
        country,
        state_region,
        city,
        address,
        admin_decision:    'pending',
        batch_id:          editBatchId,
      };
      await supaInsert('submissions', payload);
    }
    closeEditLocalPrice();
    setTimeout(() => showToast('Edit submitted — thanks! 🐝'), 300);
  } catch(e) {
    if (e?.message === 'Please sign in to submit.') { openAuthGate('deals'); return; }
    showToast('Error sending — please try again');
  }
}

let currentDealId = null;

function openDealDetail(id) {
  const d = allDeals.find(x => x.id === id);
  if (!d) return;
  closePinCard();
  currentDealId = id;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-deal-detail').classList.add('active');

  const t    = (d.business_type||'').toLowerCase();
  const emoji = dealEmoji[t] || dealEmoji.default;
  const color = dealColor[t] || dealColor.default;
  const pct   = parseFloat(d.discount||0);
  const statusBadge = d.status === 'approved'
    ? `<span class="badge" style="background:#EAF3DE;color:#3B6D11;">Active</span>`
    : `<span class="badge" style="background:#FEF3DC;color:#854F0B;">Negotiating</span>`;

  const el = document.getElementById('dealDetailContent');
  // Sanitise URL/contact schemes to prevent javascript: injection
  const dWebsite = (d.website && /^https?:\/\//i.test(d.website.trim())) ? d.website.trim() : null;
  const dPhone   = (d.contact_phone && /^[\d\s+\-().]+$/.test(d.contact_phone.trim())) ? d.contact_phone.trim() : null;

  el.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-emoji">${emoji}</div>
      <div class="detail-hero-name">${escHTML(d.business_name)}</div>
      <div class="detail-hero-sub"><i class="material-symbols-outlined">location_on</i>${escHTML(d.city||'')}${d.country?', '+escHTML(d.country):''}</div>
      <div class="detail-badges">
        <span class="badge">${escHTML(d.business_type||'Business')}</span>${statusBadge}
      </div>
    </div>

    ${pct > 0 ? `
    <div class="detail-discount-banner">
      <div class="detail-discount-pct">-${pct}%</div>
      <div class="detail-discount-text">
        <div class="detail-discount-label">Discount for Hive members</div>
        ${escHTML(d.discount_description||'Show the app to redeem')}
      </div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-title">How to redeem</div>
      ${d.discount_description ? `<div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">sell</i></div><div class="detail-row-content"><div class="detail-row-label">Offer</div><div class="detail-row-value">${escHTML(d.discount_description)}</div></div></div>` : ''}
      ${d.availability ? `<div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">schedule</i></div><div class="detail-row-content"><div class="detail-row-label">Available</div><div class="detail-row-value">${escHTML(d.availability)}</div></div></div>` : ''}
      ${d.notes ? `<div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">info</i></div><div class="detail-row-content"><div class="detail-row-label">Notes</div><div class="detail-row-value">${escHTML(d.notes)}</div></div></div>` : ''}
      ${dPhone ? `<div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">call</i></div><div class="detail-row-content"><div class="detail-row-label">Phone</div><div class="detail-row-value"><a href="tel:${escHTML(dPhone)}" style="color:var(--amber-dark);">${escHTML(dPhone)}</a></div></div></div>` : ''}
      ${dWebsite ? `<div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">language</i></div><div class="detail-row-content"><div class="detail-row-label">Website</div><div class="detail-row-value"><a href="${escHTML(dWebsite)}" target="_blank" rel="noopener noreferrer" style="color:var(--amber-dark);">${escHTML(dWebsite)}</a></div></div></div>` : ''}
    </div>

    ${d.latitude && d.longitude ? `<div class="detail-section"><div class="detail-section-title">Location</div><div class="detail-map-mini" id="dealMiniMap"></div></div>` : ''}
    <div style="height:30px;"></div>
  `;

  if (d.latitude && d.longitude) {
    setTimeout(() => {
      const lat = parseFloat(d.latitude), lng = parseFloat(d.longitude);
      const miniMap = L.map('dealMiniMap', {zoomControl:false, dragging:false, scrollWheelZoom:false, attributionControl:false});
      L.tileLayer(getTileUrl(), {maxZoom:19}).addTo(miniMap);
      miniMap.setView([lat, lng], 15);
      L.marker([lat, lng], {icon: makePin(emoji, color)}).addTo(miniMap);
    }, 100);
  }
}

// ── DEAL EDIT ──
function openEditDeal() {
  if (!currentUser) { openAuthGate('deals'); return; }
  const d = allDeals.find(x => x.id === currentDealId);
  if (!d) return;

  document.getElementById('editDealId').value          = d.id;
  document.getElementById('editDealName').value        = d.business_name      || '';
  document.getElementById('editDealBusinessType').value= d.business_type      || '';
  document.getElementById('editDealDiscount').value    = parseFloat(d.discount||0) || '';
  document.getElementById('editDealDescription').value = d.discount_description|| '';
  document.getElementById('editDealPhone').value       = d.contact_phone      || '';
  document.getElementById('editDealWebsite').value     = d.website            || '';
  document.getElementById('editDealNotes').value       = d.notes              || '';

  document.getElementById('editDealModal').classList.add('open');
}

function handleEditDealBackdrop(e) {
  if (e.target === document.getElementById('editDealModal'))
    document.getElementById('editDealModal').classList.remove('open');
}

async function submitDealEdit() {
  const name = document.getElementById('editDealName').value.trim();
  if (!name) { showToast('Please enter a business name'); return; }

  const dealId      = document.getElementById('editDealId').value;
  const cachedDeal  = allDeals ? allDeals.find(d => d.id === dealId) : null;
  const _bizType    = document.getElementById('editDealBusinessType').value.trim();
  const _discount   = document.getElementById('editDealDiscount').value.trim();
  const _desc       = document.getElementById('editDealDescription').value.trim();
  const _phone      = document.getElementById('editDealPhone').value.trim();
  const _website    = document.getElementById('editDealWebsite').value.trim();
  const _notes      = document.getElementById('editDealNotes').value.trim();

  const payload = {
    type:                  'deal_edit',
    business_name:         name,
    details:               ['EDIT OF: ' + dealId, _notes ? 'NOTES: ' + _notes : ''].filter(Boolean).join('\n'),
    business_type:         _bizType   || (cachedDeal ? cachedDeal.business_type : null),
    discount:              parseFloat(_discount) || null,
    discount_description:  _desc      || null,
    contact_phone:         _phone     || null,
    website:               _website   || null,
    latitude:              cachedDeal ? cachedDeal.latitude     : null,
    longitude:             cachedDeal ? cachedDeal.longitude    : null,
    country:               cachedDeal ? cachedDeal.country      : null,
    state_region:          cachedDeal ? cachedDeal.state_region : null,
    city:                  cachedDeal ? cachedDeal.city         : null,
    address:               cachedDeal ? cachedDeal.address      : null,
    target_id:             dealId     || null,
    submitted_by_email:    currentUser?.email || null,
    admin_decision:        'pending',
  };

  try {
    await supaInsert('submissions', payload);
    document.getElementById('editDealModal').classList.remove('open');
    setTimeout(() => showToast('Edit submitted — thanks! 🐝'), 300);
  } catch(e) {
    if (e?.message === 'Please sign in to submit.') { openAuthGate('deals'); return; }
    showToast('Error sending — please try again');
  }
}

// ── LOCAL PRICE DETAIL ──
let priceGroupsCache = {};

function openLocalPriceDetail(key) {
  const group = priceGroupsCache[key];
  if (!group) return;
  closePinCard();
  currentLocalPriceKey = key;
  const { p, cat, items } = group;

  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.getElementById('page-local-price-detail').classList.add('active');
  document.getElementById('toggleFab').classList.remove('visible');
  document.getElementById('mainFab').style.display = 'none';

  const emoji = dealEmoji[cat] || '💰';
  const color = dealColor[cat] || '#5C5750';
  const catLabel = {'coffee shop':'Café','hostel':'Hostel','bar':'Bar','activity':'Activities','groceries':'Supermarket','transport':'Transport'}[cat] || cat;
  const loc = [p.city, p.country].filter(Boolean).join(', ');

  const rows = items.map(i => {
    const normal  = parseFloat(i.price_normal||0)||null;
    const hhPrice = getActiveHH(i);
    const ldPrice = getLDPrice(i);
    const best    = getLowestPrice(i);
    const showStrike = best !== null && normal !== null && best < normal;
    const normalStr = normal ? `$${normal.toFixed(2)}` : '';
    const bestStr   = best   ? `$${best.toFixed(2)}`   : '';
    const badge = hhPrice && hhPrice === best
      ? '<span class="price-badge">⚡ Happy Hour</span>'
      : (ldPrice && ldPrice === best ? '<span class="price-badge ld">🏠 Local Discount</span>' : '');
    const priceHtml = showStrike
      ? `<span class="price-normal-val">${normalStr}</span>&nbsp;<span class="price-active-val">${bestStr}</span>${badge}`
      : `<span style="font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:var(--amber-dark);">${bestStr||normalStr}</span>`;
    return `
    <div class="detail-row">
      <div class="detail-row-icon"><i class="material-symbols-outlined">attach_money</i></div>
      <div class="detail-row-content">
        <div class="detail-row-label">${escHTML(i.item_name)}</div>
        <div class="detail-row-value">${priceHtml}</div>
      </div>
    </div>`;
  }).join('');

  const el = document.getElementById('localPriceDetailContent');
  el.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-emoji">${emoji}</div>
      <div class="detail-hero-name">${escHTML(p.business_name)}</div>
      <div class="detail-hero-sub"><i class="material-symbols-outlined">location_on</i>${escHTML(loc || 'Location not specified')}</div>
      <div class="detail-badges"><span class="badge">${catLabel}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Price list</div>
      ${rows}
    </div>

    ${p.availability ? `<div class="detail-section"><div class="detail-section-title">Availability</div><div class="detail-row"><div class="detail-row-icon"><i class="material-symbols-outlined">schedule</i></div><div class="detail-row-content"><div class="detail-row-value">${p.availability}</div></div></div></div>` : ''}

    ${p.latitude && p.longitude ? `<div class="detail-section"><div class="detail-section-title">Location</div><div class="detail-map-mini" id="localPriceMiniMap"></div></div>` : ''}
    <div style="height:30px;"></div>
  `;

  if (p.latitude && p.longitude) {
    setTimeout(() => {
      const lat = parseFloat(p.latitude), lng = parseFloat(p.longitude);
      const miniMap = L.map('localPriceMiniMap', {zoomControl:false, dragging:false, scrollWheelZoom:false, attributionControl:false});
      L.tileLayer(getTileUrl(), {maxZoom:19}).addTo(miniMap);
      miniMap.setView([lat, lng], 15);
      L.marker([lat, lng], {icon: makePin(emoji, color)}).addTo(miniMap);
    }, 100);
  }
}

const dealEmoji = {'coffee shop':'☕','hostel':'🛏️','bar':'🍺','restaurant':'🍽️','activity':'🏄','deal':'🏷️','default':'🏪'};
const dealColor = {'coffee shop':'#795548','hostel':'#1565C0','bar':'#D84315','restaurant':'#2E7D32','activity':'#6A1B9A','deal':'#00796B','default':'#D4851A'};

function initDealMap() {
  dealsLoaded = true;
  window.dealMap = dealMap = L.map('dealMap', {center:[-30,147], zoom:4, maxZoom:18, zoomControl:false});
  bindPinCardOutsideClose(dealMap);
  L.tileLayer(TILE_URL, {attribution:TILE_ATTR, maxZoom:19}).addTo(dealMap);
  liftMapAttribution(dealMap, 'deals');
  setTimeout(() => dealMap.invalidateSize(), 100);
  getUserLocation().then(pos => {
    if (pos) dealMap.setView([pos.lat, pos.lng], 11);
  });
  loadDeals();
}

async function loadDeals() {
  try {
    const rows = await supaFetch('deals', 'status=in.(approved,negotiating)&select=*,venues(*)');
    allDeals = rows.map(flattenVenue);
  } catch(e){ allDeals=[]; logError('initDealMap:deals', e, 'Could not load deals'); }
  try {
    const rows = await supaFetch('local_prices', 'status=eq.approved&select=*,venues(*)');
    allPrices = rows.map(flattenVenue);
    _allPricesMaster = [...allPrices];
  } catch(e){ allPrices=[]; _allPricesMaster = []; logError('initDealMap:prices', e, 'Could not load local prices'); }

  currentFilteredDeals = allDeals;
  document.getElementById('stat-deals').textContent = allDeals.length;
  renderDealMarkers(allDeals);
  renderDealsList(allDeals);
  renderPricesFiltered(allPrices);
  initSlider(allPrices);
}

// Normalize local_prices category to app filter keys
function normalizePriceCat(cat) {
  const c = (cat||'').toLowerCase();
  if (c === 'cafe' || c === 'coffee shop') return 'coffee shop';
  if (c === 'accommodation' || c === 'hostel') return 'hostel';
  if (c === 'bar' || c === 'bars') return 'bar';
  if (c === 'activity' || c === 'activities') return 'activity';
  if (c === 'deal' || c === 'deals') return 'deal';
  return c;
}

// Groups a deals or local_prices row under its canonical venue when one
// exists (venue_id, set by the DB matcher — see match_or_create_venue()).
// Only rows sharing the SAME real venue_id ever get merged across the two
// tables. Rows without a venue_id (shouldn't happen for anything approved
// after the venues migration, but kept as a safety net) fall back to a
// per-table string key so they never accidentally cross-merge with the
// other table based on a fuzzy name/coordinate coincidence.
function venueKeyOf(row, tablePrefix) {
  return row.venue_id
    ? `v:${row.venue_id}`
    : `${tablePrefix}:${row.business_name}|${row.latitude}|${row.longitude}`;
}

// Builds the "deal offer" block reused inside both a deals-only popup and
// a combined deal+price popup. One card per deal (almost always exactly one).
function buildDealOfferHTML(d) {
  const t   = (d.business_type||'').toLowerCase();
  const pct = parseFloat(d.discount||0);
  const sb  = d.status==='approved'
    ? `<span class="popup-status-badge popup-status-active">Active</span>`
    : `<span class="popup-status-badge popup-status-neg">Negotiating</span>`;
  return `
    <div class="popup-header">
      <span class="popup-header-emoji">${dealEmoji[t]||dealEmoji.default}</span>
      <div class="popup-header-info">
        <div class="popup-name">${escHTML(d.business_name)}</div>
        <div class="popup-detail">${escHTML(d.city||'')}</div>
      </div>
      ${pct>0?`<div class="popup-header-disc">-${pct}%</div>`:''}
    </div>
    <p class="popup-desc">${escHTML(d.discount_description||'')}</p>
    <div class="popup-status-row">
      ${sb}
      ${d.notes?`<span class="popup-note">${escHTML(d.notes)}</span>`:''}
    </div>
    <div style="text-align:center;"><button class="popup-btn" style="display:inline-block;margin-top:6px;" onclick="openDealDetail('${d.id}')">View deal details</button></div>`;
}

// Builds the price table + happy-hour/local-discount info block reused
// inside both a prices-only popup and a combined deal+price popup.
function buildPriceInfoHTML(curItems) {
  const rowsHtml = curItems.map(i => {
    const normal  = parseFloat(i.price_normal||0)||null;
    const hhPrice = getActiveHH(i);
    const ldPrice = getLDPrice(i);
    const best    = getLowestPrice(i);
    const showStrike = best !== null && normal !== null && best < normal;
    const normalStr = normal ? '$' + normal.toFixed(2) : '';
    const bestStr   = best   ? '$' + best.toFixed(2)   : '';
    const badge = hhPrice && hhPrice === best
      ? '<span class="price-badge">\u26A1 HH</span>'
      : (ldPrice && ldPrice === best ? '<span class="price-badge ld">\uD83C\uDFE0 Local</span>' : '');
    const priceCell = showStrike
      ? `<span class="price-normal-val">${normalStr}</span> <span class="price-active-val">${bestStr}</span>${badge}`
      : `<span class="popup-price-plain">${bestStr||normalStr}</span>`;
    return `<tr><td class="popup-price-cell">${escHTML(i.item_name)}</td><td class="popup-price-cell label">${priceCell}</td></tr>`;
  }).join('');

  let extraInfo = '';
  const hhItem = curItems.find(i => i.happy_hour_prices);
  const ldItem = curItems.find(i => i.local_discount);
  if (hhItem) {
    const slots = Array.isArray(hhItem.happy_hour_prices) ? hhItem.happy_hour_prices : [];
    slots.forEach(slot => {
      const isActive = getActiveHH({ ...hhItem, happy_hour_prices: [slot] }) !== null;
      const activeBadge = isActive ? ' <span class="popup-active-tag">NOW ACTIVE</span>' : '';
      extraInfo += `<div class="popup-info-row"><span class="price-badge">\u26A1 Happy Hour</span><span>${to12h(slot.from)}\u2013${to12h(slot.to)}${activeBadge}</span></div>`;
    });
  }
  if (ldItem) {
    const ld = ldItem.local_discount;
    const ldStr = ld.type === 'percent' ? `-${ld.value}%` : `$${ld.value}`;
    extraInfo += `<div class="popup-info-row"><span class="price-badge ld">\uD83C\uDFE0 Local Discount</span><span>${ldStr} off</span></div>`;
  }
  return { rowsHtml, extraInfo };
}

function renderDealMarkers(deals, priceFilter, overridePrices) {
  dealMarkers.forEach(m => dealMap.removeLayer(m)); dealMarkers = [];

  // ── Group deals by venue (falls back to a per-row legacy key for any
  // deal without a venue_id — see venueKeyOf()) ──
  const dealGroups = {};
  deals.forEach(d => {
    const lat = parseFloat(d.latitude), lng = parseFloat(d.longitude);
    if (isNaN(lat)||isNaN(lng)) return;
    const key = venueKeyOf(d, 'deal');
    if (!dealGroups[key]) dealGroups[key] = { lat, lng, deals: [] };
    dealGroups[key].deals.push(d);
  });

  // Use overridePrices if provided (avoids mutating the global allPrices)
  const priceSrc = overridePrices || allPrices;

  // ── Group local_prices by venue for THIS render (respects priceFilter) ──
  const priceGroups = {};
  priceSrc.forEach(p => {
    const cat = normalizePriceCat(p.item_category_first);
    if (priceFilter && priceFilter !== 'all' && cat !== priceFilter) return;
    const key = venueKeyOf(p, 'price');
    if (!priceGroups[key]) priceGroups[key] = { p, cat, items: [] };
    priceGroups[key].items.push(p);
  });

  // Store in cache for detail page — use _allPricesMaster (never filtered)
  // allPrices can be temporarily swapped by filterPrices()/applySubFilter()
  const master = _allPricesMaster;
  const allPriceGroups = {};
  master.forEach(p => {
    const cat = normalizePriceCat(p.item_category_first);
    const key = venueKeyOf(p, 'price');
    if (!allPriceGroups[key]) allPriceGroups[key] = { p, cat, items: [] };
    allPriceGroups[key].items.push(p);
  });
  priceGroupsCache = allPriceGroups;

  // Pre-compute lowest price per price-group to assign z-index (unchanged
  // from before — deals-only pins still get zIndexOffset 0, same as always)
  const priceEntries = {};
  Object.entries(priceGroups).forEach(([key, val]) => {
    const visibleItems = val.items.filter(isItemVisible);
    const lowestPrices = visibleItems.map(i => getLowestPrice(i)).filter(v => v !== null);
    const minPrice = lowestPrices.length ? Math.min(...lowestPrices) : null;
    if (visibleItems.length > 0) priceEntries[key] = { ...val, visibleItems, minPrice };
  });
  const validPrices = Object.values(priceEntries).map(e => e.minPrice).filter(v => v !== null);
  const globalMin = validPrices.length ? Math.min(...validPrices) : null;
  const globalMax = validPrices.length ? Math.max(...validPrices) : null;

  // ── Render one marker per venue key present in either group ──
  const allKeys = new Set([...Object.keys(dealGroups), ...Object.keys(priceEntries)]);

  allKeys.forEach(key => {
    const dealGroup  = dealGroups[key];   // { lat, lng, deals: [...] } | undefined
    const priceGroup = priceEntries[key]; // { p, cat, items, visibleItems, minPrice } | undefined
    if (!dealGroup && !priceGroup) return;

    const lat = dealGroup ? dealGroup.lat : parseFloat(priceGroup.p.latitude);
    const lng = dealGroup ? dealGroup.lng : parseFloat(priceGroup.p.longitude);
    if (isNaN(lat)||isNaN(lng)) return;

    const businessName = dealGroup ? dealGroup.deals[0].business_name : priceGroup.p.business_name;
    const city    = dealGroup ? dealGroup.deals[0].city    : priceGroup.p.city;
    const country = dealGroup ? dealGroup.deals[0].country : priceGroup.p.country;
    const loc = [city, country].filter(Boolean).join(', ');
    const safeKey = encodeURIComponent(key);

    // Icon: prefer the deal's category glyph/color when a deal is present
    // (matches prior deals-only behavior); price pin style shows the $
    // label whenever price data exists, combined or not.
    let icon, zOffset = 0;
    if (priceGroup) {
      const t = dealGroup ? (dealGroup.deals[0].business_type||'').toLowerCase() : null;
      const emoji = (t && dealEmoji[t]) || dealEmoji[priceGroup.cat] || '💰';
      const color = (t && dealColor[t]) || dealColor[priceGroup.cat] || '#5C5750';
      const priceLabel = priceGroup.minPrice !== null ? `$${priceGroup.minPrice.toFixed(2)}` : '';
      icon = makePricePin(emoji, color, priceLabel);
      zOffset = (globalMax !== null && globalMin !== null && globalMax > globalMin)
        ? Math.round((1 - (priceGroup.minPrice - globalMin) / (globalMax - globalMin)) * 1000)
        : 0;
    } else {
      const t = (dealGroup.deals[0].business_type||'').toLowerCase();
      icon = makePin(dealEmoji[t]||dealEmoji.default, dealColor[t]||dealColor.default);
    }

    // Builds popup HTML fresh each time (prices change with happy-hour windows)
    function buildPopupHTML() {
      // Tapping anywhere on the card (not just the button) opens the same
      // detail page the button would — see dealPopupCardClick() below.
      let html = '<div class="popup-inner" onclick="dealPopupCardClick(event)">';
      if (dealGroup) {
        html += dealGroup.deals.map(buildDealOfferHTML).join('<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>');
      }
      if (priceGroup) {
        const curItems = priceGroup.items.filter(isItemVisible);
        const { rowsHtml, extraInfo } = buildPriceInfoHTML(curItems);
        if (dealGroup) html += '<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>';
        else html += `<div class="popup-name">${escHTML(businessName)}</div><div class="popup-detail">${escHTML(loc)}</div>`;
        html += `<table style="width:100%;margin:8px 0;">${rowsHtml}</table>${extraInfo}<div style="text-align:center;"><button class="popup-btn" style="display:inline-block;margin-top:6px;" onclick="openLocalPriceDetail(decodeURIComponent('${safeKey}'))">View prices</button></div>`;
      }
      html += '</div>';
      return html;
    }

    const marker = L.marker([lat,lng],{icon, zIndexOffset: zOffset}).addTo(dealMap);
    marker._hiveVenueKey = key; // lets other code (e.g. search-select) find this exact marker
    if (priceGroup) marker._hivePriceKey = key; // used by refreshPricePinLabels() — only meaningful when a price component exists
    marker._hiveBuildPopup = buildPopupHTML;
    // hideClose: no ✕ button — dismiss by tapping the map or dragging the
    // handle instead. blurBackdrop + dragHandle: see styles.css / map.js.
    marker.on('click', () => openPinCard(marker._hiveBuildPopup(), { hideClose: true, blurBackdrop: true, dragHandle: true }));
    dealMarkers.push(marker);
  });
}

// Clicking anywhere on a Discounts-tab popup card (rather than just its
// button) triggers the same action — unless the tap actually landed on a
// button/link, in which case that element's own handler already runs and
// we don't want to double-fire it. See firePinCardPrimaryAction() in
// map.js (shared with the swipe-up-to-open drag gesture).
function dealPopupCardClick(e) {
  if (e.target.closest('button, a')) return;
  firePinCardPrimaryAction();
}

function toggleDealPill(btn) {
  applyDealTypeSelection(btn.dataset.dtype);
}

// Shared by the map's pill bar (toggleDealPill) and the advanced-filter
// drawer's Main Category carousel (advToggleDealType in filters.js) — both
// act on the same _activeDealTypes set, so picking a category in either
// place keeps the other in sync automatically.
function applyDealTypeSelection(type) {
  if (type === 'all') {
    _activeDealTypes.clear();
    _activeDealTypes.add('all');
  } else {
    if (_activeDealTypes.has(type)) {
      _activeDealTypes.delete(type);
    } else {
      _activeDealTypes.add(type);
    }
    _activeDealTypes.delete('all');
    if (_activeDealTypes.size === 0) _activeDealTypes.add('all');
  }

  // Update the map pill bar
  document.querySelectorAll('#page-deals .filter-pill[data-dtype]').forEach(p => {
    p.classList.toggle('active', _activeDealTypes.has(p.dataset.dtype));
  });

  // Update the drawer too, if it's currently open on Deals
  if (typeof advContext !== 'undefined' && advContext === 'deals') renderAdvPanel('deals');

  applyDealPillFilter();
}

function applyDealPillFilter() {
  // Determine the combined type key for the slider label
  const types = [..._activeDealTypes];
  const isSingle = !_activeDealTypes.has('all') && types.length === 1;
  const singleType = isSingle ? types[0] : null;

  // The item sub-filter (see advToggleSubFilterItem in filters.js) only makes
  // sense for the single category it was built from — reset it whenever the
  // active category pill(s) change.
  currentSubFilter = [];
  advState.deals.subFilters = [];

  // Filter deals
  let f;
  if (_activeDealTypes.has('all')) {
    f = allDeals;
  } else {
    f = allDeals.filter(d => {
      const bt = (d.business_type||'').toLowerCase();
      return types.some(t => bt.includes(t));
    });
  }
  currentFilteredDeals = f;
  currentDealsType = singleType || 'all';

  // Price category filter: union of all active types
  const srcPrices = _allPricesMaster;
  let catPrices;
  if (_activeDealTypes.has('all')) {
    catPrices = srcPrices;
  } else {
    catPrices = srcPrices.filter(p => types.some(t => normalizePriceCat(p.item_category_first) === t));
  }
  initSlider(catPrices.length ? catPrices : srcPrices);

  // Slider label
  const catLabels = { bar:'Bar prices', 'coffee shop':'Café prices', hostel:'Hostel prices', activity:'Activity prices', deal:'Deal prices', all:'Price' };
  document.querySelector('#priceSliderBar > span').textContent = singleType ? (catLabels[singleType] || 'Price') : 'Price';

  renderDealMarkers(f, singleType || 'all');
  renderDealsList(f);
}

function filterDeals(btn, type) {
  // Legacy shim used by goToDealsWithFilter and applyAdvFilter
  _activeDealTypes.clear();
  _activeDealTypes.add(type);
  document.querySelectorAll('#page-deals .filter-pill[data-dtype]').forEach(p => {
    p.classList.toggle('active', p.dataset.dtype === type);
  });
  applyDealPillFilter();
}

// buildSubFilters()/applySubFilter() used to render the item dropdown
// directly on the map. That control now lives inside the advanced filters
// drawer instead, as a Sub Category chip carousel — see the deals section
// of renderAdvPanel() and advToggleSubFilterItem() in filters.js.

function renderDealsList(deals) {
  const byCity = {};
  deals.forEach(d => { const k=`${d.city||''}, ${d.country||''}`; if(!byCity[k])byCity[k]=[]; byCity[k].push(d); });
  const icons = {'coffee shop':'☕','hostel':'🛏️','bar':'🍺','restaurant':'🍽️','activity':'🏄'};
  let html = '';
  const sortedCities = Object.keys(byCity).sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  for (const city of sortedCities) {
    const cd = byCity[city].sort((a, b) => (a.business_name||'').localeCompare(b.business_name||'', undefined, {numeric:true, sensitivity:'base'}));
    html += `<div class="city-section"><div class="city-label"><i class="material-symbols-outlined">location_on</i> ${city}</div>`;
    cd.forEach(d => {
      const icon = icons[(d.business_type||'').toLowerCase()]||'🏪';
      const pct  = parseFloat(d.discount||0);
      html += `<div class="deal-card" onclick="openDealDetail('${escHTML(d.id)}')"><div class="deal-card-header"><div class="deal-logo">${icon}</div><div><div class="deal-name">${escHTML(d.business_name)}</div><div class="deal-type">${escHTML(d.business_type||'')}</div></div>${pct>0?`<div class="deal-discount">-${pct}%</div>`:''}</div><p class="deal-desc">${escHTML(d.discount_description||'')}</p><div class="deal-footer"><span class="deal-status ${d.status==='approved'?'active':'pending'}">${d.status==='approved'?'Active':'Negotiating'}</span>${d.notes?`<span class="deal-verify"><i class="material-symbols-outlined">info</i>${escHTML(d.notes)}</span>`:''}</div></div>`;
    });
    html += '</div>';
  }
  document.getElementById('dealsContainer').innerHTML = html || '<div class="map-loading">No deals yet.</div>';
}

function renderPricesFiltered(prices, maxVal) {
  const bc = {};
  prices.forEach(p => { const k=p.item_category_first||'other'; if(!bc[k])bc[k]=[]; bc[k].push(p); });
  const ci = {'coffee shop':'local_cafe','cafe':'local_cafe','hostel':'bed','accommodation':'bed','bar':'sports_bar','bars':'sports_bar','activity':'local_activity','groceries':'storefront','transport':'directions_bus','other':'payments'};
  const cl = {'coffee shop':'Café','cafe':'Café','hostel':'Hostel','accommodation':'Hostel','bar':'Bar','bars':'Bar','activity':'Activities','groceries':'Supermarket','transport':'Transport','other':'Other'};
  let html = '';
  const sortedCats = Object.keys(bc).sort((a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  for (const cat of sortedCats) {
    const items = bc[cat].sort((a, b) => (a.business_name||'').localeCompare(b.business_name||'', undefined, {numeric:true, sensitivity:'base'}));
    const city = items[0].city&&items[0].country ? `(${items[0].city}, ${items[0].country})` : '';
    const rowsHtml = items.map(p => {
      const normal  = parseFloat(p.price_normal||0)||null;
      const hhPrice = getActiveHH(p);
      const ldPrice = getLDPrice(p);
      const best    = getLowestPrice(p);
      const showStrike = best !== null && normal !== null && best < normal;
      const normalStr = normal ? `AUD ${normal.toFixed(2)}` : '';
      const bestStr   = best   ? `AUD ${best.toFixed(2)}`   : '';
      const badge = hhPrice && hhPrice === best
        ? '<span class="price-badge" style="font-size:10px;vertical-align:middle;margin-left:4px;">⚡ HH</span>'
        : (ldPrice && ldPrice === best ? '<span class="price-badge ld" style="font-size:10px;vertical-align:middle;margin-left:4px;">🏠 Local</span>' : '');
      const priceCell = showStrike
        ? `<span class="price-normal-val" style="font-size:12px;">${normalStr}</span> <span style="font-weight:700;color:var(--amber-dark);">${bestStr}</span>${badge}`
        : `<span>${bestStr||normalStr}</span>${badge}`;
      return `<tr><td>${escHTML(p.item_name)}</td><td>${priceCell}</td></tr>`;
    }).join('');
    html += `<div class="price-card"><div class="price-card-header"><i class="material-symbols-outlined">${ci[cat]||'payments'}</i><div class="price-card-title">${cl[cat]||escHTML(cat)} ${escHTML(city)}</div></div><table class="price-table">${rowsHtml}</table></div>`;
  }
  document.getElementById('pricesContainer').innerHTML = html || `<div class="map-loading">No items${maxVal ? ' under $'+maxVal : ''}.</div>`;
}



