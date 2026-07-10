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

  // Header title shows the business name itself (flanked by the back
  // button on the left and the Edit button on the right) — same pattern
  // as openLocalPriceDetail() below.
  const titleEl = document.getElementById('dealDetailTitle');
  if (titleEl) titleEl.textContent = d.business_name || '';

  const el = document.getElementById('dealDetailContent');
  // Sanitise URL/contact schemes to prevent javascript: injection
  const dWebsite = (d.website && /^https?:\/\//i.test(d.website.trim())) ? d.website.trim() : null;
  const dPhone   = (d.contact_phone && /^[\d\s+\-().]+$/.test(d.contact_phone.trim())) ? d.contact_phone.trim() : null;

  el.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-emoji">${emoji}</div>
      <div class="detail-hero-name">${escHTML(d.business_name)}</div>
      <div class="detail-hero-sub"><i class="material-symbols-outlined">location_on</i>${escHTML(d.city||'')}${d.country?', '+escHTML(d.country):''}</div>
      ${buildHoursWidgetHTML(d.opening_hours_json, d.opening_hours || d.availability, 'dealHoursWidget')}
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

  const renderPriceRow = (i) => {
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
  };

  // Bar venues get their price list split into Beers / Wines /
  // Cocktails & Spirits (rather than one flat list) — see
  // classifyDrinkGroup() below. Every other category keeps a flat list,
  // since the split only makes sense for a drinks menu.
  let rows;
  if (cat === 'bar') {
    const buckets = { 'Beers': [], 'Wines': [], 'Cocktails & Spirits': [], 'Other drinks': [] };
    items.forEach(i => buckets[classifyDrinkGroup(i.item_name)].push(i));
    rows = Object.entries(buckets)
      .filter(([, arr]) => arr.length)
      .map(([label, arr]) => `<div class="price-group-label">${label}</div>${arr.map(renderPriceRow).join('')}`)
      .join('');
  } else {
    rows = items.map(renderPriceRow).join('');
  }

  // Header title now shows the business name itself (flanked by the
  // back button on the left and the Edit button on the right) instead of
  // a generic "Local Prices" label.
  const titleEl = document.getElementById('localPriceDetailTitle');
  if (titleEl) titleEl.textContent = p.business_name || '';

  const el = document.getElementById('localPriceDetailContent');
  el.innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-name detail-hero-name-chip" style="background:${color};">${escHTML(p.business_name)}</div>
      <div class="detail-hero-sub-row">
        <div class="detail-hero-sub"><i class="material-symbols-outlined">location_on</i>${escHTML(loc || 'Location not specified')}</div>
        ${buildVenueActionsHTML(parseFloat(p.latitude), parseFloat(p.longitude), p.business_name, p.address)}
      </div>
      ${buildHoursWidgetHTML(p.opening_hours_json, p.opening_hours || p.availability, 'localPriceHoursWidget')}
      <div class="detail-badges"><span class="badge">${catLabel}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Price list</div>
      ${rows}
    </div>

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

// Heuristic classifier used only to split a bar venue's price list into
// Beers / Wines / Cocktails & Spirits sections (see openLocalPriceDetail
// above) — there's no structured drink-type field on local_prices items,
// just a free-text item_name, so this matches on common keywords.
// Anything that doesn't match falls into "Other drinks" (e.g. soft
// drinks, mocktails) rather than being force-fit into a wrong bucket.
function classifyDrinkGroup(itemName) {
  const n = (itemName||'').toLowerCase();
  if (/\b(beer|beers|lager|pilsner|pale ale|ipa|stout|porter|pint|schooner|midi|cider)\b/.test(n)) return 'Beers';
  if (/\b(wine|wines|vino|prosecco|champagne|sparkling|ros[eé]|shiraz|chardonnay|sauvignon|pinot|merlot|cabernet)\b/.test(n)) return 'Wines';
  if (/\b(cocktail|cocktails|spirit|spirits|vodka|gin|rum|whisk(e)?y|tequila|bourbon|martini|mojito|margarita|spritz|negroni|old fashioned|daiquiri|liqueur|shot)\b/.test(n)) return 'Cocktails & Spirits';
  return 'Other drinks';
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

// Picks a single, display-ready category label out of a possibly
// comma-separated category string (business_type / item_category_first
// can carry more than one category) — always just the first one, title-cased.
function firstCategoryLabel(raw) {
  if (!raw) return '';
  const first = String(raw).split(',')[0].trim();
  if (!first) return '';
  return first.replace(/\b\w/g, c => c.toUpperCase());
}

// Builds the "deal offer" block reused inside both a deals-only popup and
// a combined deal+price popup. One card per deal (almost always exactly one).
// hhBadgeHtml (optional): the HH countdown pill's markup — stacked above the
// Info/Saved/Edit row in the top-right grid cell (see .popup-top-right in
// styles.css) — only passed for the first deal in the group (avoids showing
// the same countdown twice on a venue with multiple stacked deal offers).
//
// Card layout (CSS Grid, not float — see .popup-top-grid in styles.css):
//   ┌────────────────────┬──────────────────┐
//   │ Name                │  HH countdown    │
//   │ Category            │ Info·Saved·Edit  │
//   ├────────────────────┴──────────────────┤
//   │       Opening/closing hours (full width)      │
//   ├────────────────────────────────────────┤
//   │ ⇄ Directions · Share · Uber · Edit · Save (scroll) │
//   └────────────────────────────────────────┘
function buildDealOfferHTML(d, hhBadgeHtml) {
  const sb  = d.status==='approved'
    ? `<span class="popup-status-badge popup-status-active">Active</span>`
    : `<span class="popup-status-badge popup-status-neg">Negotiating</span>`;
  const catLabel = firstCategoryLabel(d.business_type);
  const lat = parseFloat(d.latitude), lng = parseFloat(d.longitude);
  return `
    <div class="popup-top-grid">
      <div class="popup-top-left">
        <div class="popup-name">${escHTML(d.business_name)}</div>
        ${catLabel ? `<div class="popup-detail">${escHTML(catLabel)}</div>` : ''}
      </div>
      <div class="popup-top-right">
        ${hhBadgeHtml||''}
        ${buildVenueTopActionsHTML(d.id, 'deal')}
      </div>
    </div>
    ${buildHoursWidgetHTML(d.opening_hours_json, d.opening_hours || d.availability, 'popupHoursWidget')}
    ${buildVenueActionsCarouselHTML(lat, lng, d.business_name, d.address, d.id, 'deal')}
    <p class="popup-desc">${escHTML(d.discount_description||'')}</p>
    <div class="popup-status-row">
      ${sb}
      ${d.notes?`<span class="popup-note">${escHTML(d.notes)}</span>`:''}
    </div>
    <div style="text-align:center;"><button class="popup-btn" style="display:inline-block;margin-top:6px;" onclick="openDealDetail('${d.id}')">View deal details</button></div>`;
}

// ── TOP-RIGHT QUICK ACTIONS (Info / Saved·Loved / Edit) ──
// Sits in the top-right grid cell (.popup-top-right), stacked below the HH
// countdown badge when one is present. Shared by deal-offer cards and
// price-only cards — kind ('deal' | 'price') picks which detail page Info
// opens and which edit modal Edit opens; id is the deal's row id for
// 'deal', or the (already encodeURIComponent'd, matching the existing
// safeKey convention below) venue key for 'price'. Saved/Loved is a
// client-only toggle for now (stored in localStorage, same pattern as the
// forum's like buttons — see getLikedSet()/saveLikedSet() in forum.js);
// there's no `venue_saves` table yet, so this doesn't sync across devices.
function buildVenueTopActionsHTML(id, kind) {
  const saved = isVenueSaved(id, kind);
  const infoOnclick = kind === 'price'
    ? `openLocalPriceDetail(decodeURIComponent('${id}'))`
    : `openDealDetail('${id}')`;
  const editOnclick = kind === 'price'
    ? `popupEditLocalPriceClick('${id}')`
    : `popupEditDealClick('${id}')`;
  return `<div class="popup-action-row">
    <button class="popup-action-btn" onclick="event.stopPropagation();${infoOnclick}" title="Info" aria-label="Info">
      <i class="material-symbols-outlined">info</i>
    </button>
    <button class="popup-action-btn popup-save-btn${saved ? ' saved' : ''}" data-venue-key="${kind}:${id}" onclick="event.stopPropagation();toggleVenueSaved(this)" title="${saved ? 'Loved' : 'Save'}" aria-label="Save">
      <i class="material-symbols-outlined">${saved ? 'favorite' : 'favorite_border'}</i>
    </button>
    <button class="popup-action-btn" onclick="event.stopPropagation();${editOnclick}" title="Edit" aria-label="Edit">
      <i class="material-symbols-outlined">edit</i>
    </button>
  </div>`;
}

// ── QUICK-ACTIONS CAROUSEL (Directions / Share / Uber / Edit / Save) ──
// Horizontally-scrollable row of labelled pill buttons, full card width,
// sitting below the opening-hours widget. Duplicates the Directions/Share/
// Uber actions from buildVenueActionsHTML() (kept icon-only in the
// top-right corner for at-a-glance access) plus Edit/Save again as labelled
// buttons for anyone who prefers the fuller carousel. All buttons here
// stay in sync with their top-right counterparts — toggleVenueSaved()
// updates every .popup-save-btn for the same venue key, wherever it sits
// on the card. Shared by deal-offer and price-only cards — see
// buildVenueTopActionsHTML() above for the id/kind convention.
function buildVenueActionsCarouselHTML(lat, lng, name, address, id, kind) {
  const hasCoords = isFinite(lat) && isFinite(lng);
  const saved = isVenueSaved(id, kind);
  const editOnclick = kind === 'price'
    ? `popupEditLocalPriceClick('${id}')`
    : `popupEditDealClick('${id}')`;
  return `<div class="popup-quick-carousel">
    <button class="popup-carousel-btn" data-lat="${hasCoords?lat:''}" data-lng="${hasCoords?lng:''}" data-addr="${escHTML(address||'')}" onclick="event.stopPropagation();venueDirectionsClick(this)">
      <i class="material-symbols-outlined">directions</i><span>Directions</span>
    </button>
    <button class="popup-carousel-btn" data-name="${escHTML(name||'')}" data-addr="${escHTML(address||'')}" onclick="event.stopPropagation();venueShareClick(this)">
      <i class="material-symbols-outlined">share</i><span>Share</span>
    </button>
    <button class="popup-carousel-btn" data-lat="${hasCoords?lat:''}" data-lng="${hasCoords?lng:''}" data-name="${escHTML(name||'')}" onclick="event.stopPropagation();venueUberClick(this)">
      <i class="material-symbols-outlined">local_taxi</i><span>Uber</span>
    </button>
    <button class="popup-carousel-btn" onclick="event.stopPropagation();${editOnclick}">
      <i class="material-symbols-outlined">edit</i><span>Edit</span>
    </button>
    <button class="popup-carousel-btn popup-save-btn${saved ? ' saved' : ''}" data-venue-key="${kind}:${id}" onclick="event.stopPropagation();toggleVenueSaved(this)">
      <i class="material-symbols-outlined">${saved ? 'favorite' : 'favorite_border'}</i><span>${saved ? 'Loved' : 'Save'}</span>
    </button>
  </div>`;
}

// ── SAVED / LOVED VENUES (client-only for now — no `venue_saves` table) ──
// Deals and local-price venues share one localStorage set, keyed
// "kind:id" (e.g. "deal:abc123" / "price:some%20venue%7Ckey") so a deal
// and a local-price entry can never collide even if their raw ids happen
// to match.
function isVenueSaved(id, kind) {
  return getLikedSet('hive_saved_venues').has(`${kind}:${id}`);
}

// Toggles save state and updates every matching button on the card (the
// icon-only top-right one and the labelled carousel one share
// data-venue-key, so both flip together regardless of which was tapped).
function toggleVenueSaved(btn) {
  const venueKey = btn.dataset.venueKey;
  const savedSet = getLikedSet('hive_saved_venues');
  const willSave = !savedSet.has(venueKey);
  if (willSave) savedSet.add(venueKey); else savedSet.delete(venueKey);
  saveLikedSet('hive_saved_venues', savedSet);

  document.querySelectorAll(`.popup-save-btn[data-venue-key="${venueKey}"]`).forEach(el => {
    el.classList.toggle('saved', willSave);
    const icon = el.querySelector('i');
    if (icon) icon.textContent = willSave ? 'favorite' : 'favorite_border';
    const label = el.querySelector('span');
    if (label) label.textContent = willSave ? 'Loved' : 'Save';
    el.title = willSave ? 'Loved' : 'Save';
  });
  showToast(willSave ? 'Saved to your loved deals ❤️' : 'Removed from loved deals');
}

// Opens the edit-deal modal directly from the map popup, without needing
// to visit the full deal detail page first — reuses openEditDeal() below,
// which reads the deal off `currentDealId` + the allDeals cache.
function popupEditDealClick(dealId) {
  if (!currentUser) { openAuthGate('deals'); return; }
  currentDealId = dealId;
  openEditDeal();
}

// Same idea for local prices — opens the edit-local-price modal directly
// from the map popup. encodedKey arrives already encodeURIComponent'd
// (see safeKey below), matching how openLocalPriceDetail() is called from
// the "View more" button, so it's decoded once here before being stashed
// on currentLocalPriceKey (openEditLocalPrice() below looks that up in
// priceGroupsCache, which is keyed by the raw, undecoded key).
function popupEditLocalPriceClick(encodedKey) {
  if (!currentUser) { openAuthGate('deals'); return; }
  currentLocalPriceKey = decodeURIComponent(encodedKey);
  openEditLocalPrice();
}

// ── VENUE QUICK ACTIONS (Directions / Share / Uber) ──
// Small 3-button row shown just below the name+countdown area of a
// Discounts popup card. Reused by both the deal path (buildDealOfferHTML)
// and the price-only path (renderDealMarkers' inline name row) — only one
// of those ever renders per card (see venueKeyOf() grouping above), so
// this never shows twice on the same card.
// Coordinates/name/address travel via data-* attributes (rather than
// inline onclick args) so venue names/addresses containing quotes or
// other special characters can't break the markup.
function buildVenueActionsHTML(lat, lng, name, address) {
  const hasCoords = isFinite(lat) && isFinite(lng);
  return `<div class="popup-action-row">
    <button class="popup-action-btn" data-lat="${hasCoords?lat:''}" data-lng="${hasCoords?lng:''}" data-addr="${escHTML(address||'')}" onclick="event.stopPropagation();venueDirectionsClick(this)" title="Directions" aria-label="Directions">
      <i class="material-symbols-outlined">directions</i>
    </button>
    <button class="popup-action-btn" data-name="${escHTML(name||'')}" data-addr="${escHTML(address||'')}" onclick="event.stopPropagation();venueShareClick(this)" title="Share" aria-label="Share">
      <i class="material-symbols-outlined">share</i>
    </button>
    <button class="popup-action-btn" data-lat="${hasCoords?lat:''}" data-lng="${hasCoords?lng:''}" data-name="${escHTML(name||'')}" onclick="event.stopPropagation();venueUberClick(this)" title="Uber" aria-label="Uber">
      <i class="material-symbols-outlined">local_taxi</i>
    </button>
  </div>`;
}

function venueDirectionsClick(btn) {
  openVenueDirections(btn.dataset.lat, btn.dataset.lng, btn.dataset.addr);
}

// Opens turn-by-turn directions in whichever maps app the person's device
// actually uses — Apple Maps on iOS/macOS, Google Maps everywhere else.
function openVenueDirections(lat, lng, address) {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !window.MSStream;
  const hasCoords = lat && lng && lat !== '' && lng !== '';
  const dest = hasCoords ? `${lat},${lng}` : (address ? encodeURIComponent(address) : '');
  if (!dest) { showToast('Location not available'); return; }
  const url = isApple
    ? `https://maps.apple.com/?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  window.open(url, '_blank');
}

function venueShareClick(btn) {
  shareVenue(btn.dataset.name, btn.dataset.addr);
}

// Uses the native Web Share sheet when available (mobile browsers/PWA);
// falls back to a toast on desktop browsers that don't support it.
async function shareVenue(name, address) {
  const shareData = {
    title: name || 'The Hive',
    text: [name, address].filter(Boolean).join(' — ') || 'Check this out on The Hive',
    url: window.location.href
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch(e) { /* user cancelled the share sheet — ignore */ }
  } else {
    showToast('Sharing not supported on this device');
  }
}

function venueUberClick(btn) {
  openUberRide(btn.dataset.lat, btn.dataset.lng, btn.dataset.name);
}

// Opens Uber's universal link, pre-filling this venue as the dropoff and
// the rider's current location as pickup. Opens the Uber app if installed,
// otherwise falls back to the mobile web / app-store page automatically.
function openUberRide(lat, lng, name) {
  if (!lat || !lng) { showToast('Location not available'); return; }
  let url = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`
    + `&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`;
  if (name) url += `&dropoff[nickname]=${encodeURIComponent(name)}`;
  window.open(url, '_blank');
}

// Picks up to 2 items to surface in the popup when a venue has several
// priced items. Priority: 1) an item matching what the person is
// currently searching for (header search box), paired with 2) the
// cheapest item right now (happy-hour/local-discount prices already
// factored in via getLowestPrice). When there's no search match, just
// shows the two cheapest items. Falls back to fewer items if the venue
// doesn't have that many.
function pickDisplayItems(curItems) {
  if (!curItems.length) return [];
  if (curItems.length <= 2) return curItems;

  const byPrice = [...curItems].sort((a, b) => {
    const pa = getLowestPrice(a), pb = getLowestPrice(b);
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pa - pb;
  });

  const searchEl = document.getElementById('searchInput');
  const q = (searchEl && searchEl.value || '').trim().toLowerCase();
  const searchMatch = q ? curItems.find(i => (i.item_name||'').toLowerCase().includes(q)) : null;

  if (searchMatch) {
    const runnerUp = byPrice.find(i => i !== searchMatch) || null;
    return runnerUp ? [searchMatch, runnerUp] : [searchMatch];
  }

  // No search match — show the two cheapest items
  return byPrice.slice(0, 2);
}

// Soonest end-time (a Date) of whichever happy-hour slot on this item is
// active right now, or null if none is active. Used to drive the
// countdown badge in the popup card (see startPopupHHTimer() below).
function getHHEndTime(item) {
  const slots = Array.isArray(item.happy_hour_prices) ? item.happy_hour_prices : [];
  if (!slots.length) return null;
  const now = new Date();
  const day = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
  const nowMin = now.getHours()*60 + now.getMinutes();
  let soonestEnd = null;
  slots.forEach(slot => {
    const days = Array.isArray(slot.days) ? slot.days : [];
    if (!days.includes(day)) return;
    const [fh, fm] = (slot.from||'0:0').split(':').map(Number);
    const [th, tm] = (slot.to||'0:0').split(':').map(Number);
    const fromMin = fh*60 + (fm||0), toMin = th*60 + (tm||0);
    if (nowMin >= fromMin && nowMin < toMin) {
      const endDate = new Date(now);
      endDate.setHours(th, tm, 0, 0);
      if (soonestEnd === null || endDate < soonestEnd) soonestEnd = endDate;
    }
  });
  return soonestEnd;
}

// Soonest future start (a Date) of any happy-hour slot on this item, scanned
// day-by-day starting today (later slots today count, ones that already
// started/passed don't) through the next 7 days. Returns null if the item
// has no happy-hour slots at all. Only meaningful when nothing is active
// right now — see getHHEndTime() above for the active case, and
// buildHHBadgeHTML() below for how the two are chosen between.
function getHHNextStart(item) {
  const slots = Array.isArray(item.happy_hour_prices) ? item.happy_hour_prices : [];
  if (!slots.length) return null;
  const now = new Date();
  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  let soonest = null;
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const dayKey = dayKeys[d.getDay()];
    slots.forEach(slot => {
      const days = Array.isArray(slot.days) ? slot.days : [];
      if (!days.includes(dayKey)) return;
      const [fh, fm] = (slot.from||'0:0').split(':').map(Number);
      const startDate = new Date(d);
      startDate.setHours(fh, fm||0, 0, 0);
      if (startDate <= now) return; // already started (or passed) today
      if (soonest === null || startDate < soonest) soonest = startDate;
    });
    if (soonest) break; // found the earliest day it recurs on — no need to look further ahead
  }
  return soonest;
}

// Builds the price row(s) + happy-hour/local-discount info block reused
// inside both a prices-only popup and a combined deal+price popup. Shows
// up to 2 items — see pickDisplayItems() — rather than every priced item
// at the venue, so the card stays scannable.
function buildPriceInfoHTML(curItems) {
  const items = pickDisplayItems(curItems);
  if (!items.length) return { rowsHtml: '', extraInfo: '', hhEnd: null, hhNext: null, hhSlots: [] };

  let rowsHtml = '';
  let extraInfo = '';
  let hhEnd = null;
  let hhNext = null;
  const hhSlots = []; // unique happy-hour windows across displayed items — feeds the day-by-day schedule dropdown
  const seenSlotKeys = new Set();
  const seenInfoLines = new Set(); // dedupe identical HH/local-discount lines across the 2 displayed items

  items.forEach(item => {
    const normal  = parseFloat(item.price_normal||0)||null;
    const hhPrice = getActiveHH(item);
    const ldPrice = getLDPrice(item);
    const best    = getLowestPrice(item);
    const showStrike = best !== null && normal !== null && best < normal;
    const normalStr = normal ? '$' + normal.toFixed(2) : '';
    const bestStr   = best   ? '$' + best.toFixed(2)   : '';
    const badge = hhPrice && hhPrice === best
      ? '<span class="price-badge">\u26A1 HH</span>'
      : (ldPrice && ldPrice === best ? '<span class="price-badge ld">\uD83C\uDFE0 Local</span>' : '');
    const priceCell = showStrike
      ? `<span class="price-normal-val">${normalStr}</span> <span class="price-active-val">${bestStr}</span>${badge}`
      : `<span class="popup-price-plain">${bestStr||normalStr}</span>`;
    rowsHtml += `<tr><td class="popup-price-cell">${escHTML(item.item_name)}</td><td class="popup-price-cell label">${priceCell}</td></tr>`;

    if (item.happy_hour_prices) {
      const slots = Array.isArray(item.happy_hour_prices) ? item.happy_hour_prices : [];
      // Used to feed the day-by-day schedule dropdown attached to the HH
      // badge (see buildHHScheduleHTML()) — the per-window "⚡ HH xAM–yPM
      // NOW ACTIVE" line that used to render here at the bottom of the
      // card was removed; the badge + its dropdown cover that now.
      slots.forEach(slot => {
        const slotKey = `${slot.from}-${slot.to}-${(slot.days||[]).join(',')}`;
        if (!seenSlotKeys.has(slotKey)) { seenSlotKeys.add(slotKey); hhSlots.push(slot); }
      });
      // Keep the countdown badge tied to whichever displayed item's HH
      // window ends soonest, so it doesn't just reflect the last item looped.
      const itemHHEnd = getHHEndTime(item);
      if (itemHHEnd && (!hhEnd || itemHHEnd < hhEnd)) hhEnd = itemHHEnd;
      // Only matters when nothing is active anywhere among the displayed
      // items — see buildHHBadgeHTML(), which prefers hhEnd over hhNext.
      const itemHHNext = getHHNextStart(item);
      if (itemHHNext && (!hhNext || itemHHNext < hhNext)) hhNext = itemHHNext;
    }
    if (item.local_discount) {
      const ld = item.local_discount;
      const ldStr = ld.type === 'percent' ? `-${ld.value}%` : `$${ld.value}`;
      const lineKey = `ld:${ldStr}`;
      if (!seenInfoLines.has(lineKey)) {
        seenInfoLines.add(lineKey);
        extraInfo += `<div class="popup-info-row"><span class="price-badge ld">\uD83C\uDFE0 Local Discount</span><span>${ldStr} off</span></div>`;
      }
    }
  });

  return { rowsHtml, extraInfo, hhEnd, hhNext, hhSlots };
}

// ── Happy-hour countdown badge (top-right of the popup card) ──
// Started from openPinCard()'s onOpen callback (see marker.on('click', …)
// below) and stopped from closePinCard() in map.js. Ticks every 30s —
// coarse enough for a minutes-remaining display without a jittery re-render.
// Handles both badge states (see buildHHBadgeHTML() below): #popupHHTimer
// (active — counting down to close) and #popupHHTimerNext (not active —
// counting down to the next window's open time). Only one is ever present
// in a given card at once, but checking both here means a single interval
// covers either case without the caller needing to know which it got.
let _hhTimerInterval = null;
// Reads "Happy Hour ⚡ Xh Ym left/till" for the first 3s after a card
// opens, then the "Happy Hour" label slides out and disappears (see
// scheduleHHLabelCollapse() / .popup-hh-timer-label.collapsed in
// styles.css), leaving just the compact "⚡ Xh Ym left/till" badge.
let _hhLabelCollapseTimeout = null;

function stopPopupHHTimer() {
  if (_hhTimerInterval) { clearInterval(_hhTimerInterval); _hhTimerInterval = null; }
  clearTimeout(_hhLabelCollapseTimeout);
  _hhLabelCollapseTimeout = null;
}

// Renders a duration in ms as "Xh Ym" under a day, or "Xd Yh" once it spans
// a full day or more — minutes get dropped entirely at that point, with the
// hour uplifted to the next whole hour rather than truncated (so 1d 0m05s
// reads as "1d 1h", not "1d 0h").
function _formatHHDuration(msLeft) {
  const totalMin = Math.ceil(msLeft / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days > 0) {
    const remainMin = totalMin % 1440;
    const hours = Math.ceil(remainMin / 60);
    if (hours === 24) return `${days + 1}d`; // rounded all the way into the next day
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m`;
}

// Only the time portion updates on each tick — the "Happy Hour" label
// (see buildHHBadgeHTML()) is static text, untouched here so it isn't
// fought over by the collapse animation mid-transition.
function tickPopupHHTimer() {
  const activeEl = document.getElementById('popupHHTimer');
  const nextEl   = document.getElementById('popupHHTimerNext');
  if (!activeEl && !nextEl) { stopPopupHHTimer(); return; }

  if (activeEl) {
    const timeEl = document.getElementById('popupHHTimerTime');
    const endIso = activeEl.dataset.hhEnd;
    const msLeft = endIso ? new Date(endIso) - new Date() : -1;
    if (timeEl) timeEl.textContent = msLeft > 0 ? `\u26A1 ${_formatHHDuration(msLeft)} left` : '\u26A1 Ended';
  }
  if (nextEl) {
    const timeEl = document.getElementById('popupHHTimerNextTime');
    const nextIso = nextEl.dataset.hhNext;
    const msLeft = nextIso ? new Date(nextIso) - new Date() : -1;
    if (timeEl) timeEl.textContent = msLeft > 0 ? `\u26A1 ${_formatHHDuration(msLeft)} till` : '\u26A1 Starting soon';
  }
}

// 3s after the card opens, collapses the "Happy Hour" label out of
// whichever badge is present, leaving the compact "⚡ Xh Ym left/till"
// form — the badge shrinks to match since the label's width animates to 0
// rather than just being hidden (see .popup-hh-timer-label in styles.css).
function scheduleHHLabelCollapse() {
  const label = document.querySelector('.popup-hh-timer-label');
  if (!label) return;
  label.classList.remove('collapsed'); // in case any stale state lingered
  _hhLabelCollapseTimeout = setTimeout(() => label.classList.add('collapsed'), 3000);
}

function startPopupHHTimer() {
  stopPopupHHTimer();
  tickPopupHHTimer();
  _hhTimerInterval = setInterval(tickPopupHHTimer, 30000);
  scheduleHHLabelCollapse();
}

// ── Day-by-day happy-hour schedule dropdown ──
// Tapping the HH badge (either state) opens a small dropdown, anchored to
// the badge itself, listing every day's window(s) — "No happy hour" for
// days with none. slots is the deduped list gathered in buildPriceInfoHTML().
function buildHHScheduleHTML(slots, widgetId) {
  const dayKeys   = ['sun','mon','tue','wed','thu','fri','sat'];
  const dayLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayIdx  = new Date().getDay();
  const rows = dayKeys.map((key, idx) => {
    const daySlots = slots.filter(s => Array.isArray(s.days) && s.days.includes(key));
    const timeStr = daySlots.length
      ? daySlots.map(s => `${to12h(s.from)}\u2013${to12h(s.to)}`).join(', ')
      : 'No happy hour';
    return `<div class="hh-week-row${idx === todayIdx ? ' today' : ''}">
      <span class="hh-week-day">${dayLabels[idx]}</span>
      <span class="hh-week-time">${escHTML(timeStr)}</span>
    </div>`;
  }).join('');
  return `<div class="hh-schedule-dropdown" id="${widgetId}">${rows}</div>`;
}

// Builds the HH badge (whichever state applies) plus its attached schedule
// dropdown. Three outcomes:
//   • Happy hour active right now (hhEnd set) → solid amber "Happy Hour
//     ⚡ Xh Ym left", kept ticking by startPopupHHTimer()/tickPopupHHTimer()
//     above, with the "Happy Hour" label collapsing away after 3s (see
//     scheduleHHLabelCollapse()).
//   • Not active, but the venue has happy-hour data on file (hhNext set)
//     → lighter "Happy Hour ⚡ Xh Ym till" badge, same collapse behavior.
//   • No happy-hour data at all → renders nothing, same as before.
function buildHHBadgeHTML(hhEnd, hhNext, hhSlots) {
  if (!hhEnd && !hhNext) return '';
  const widgetId = 'hhSchedule_' + Math.random().toString(36).slice(2, 9);
  const isActive = !!hhEnd;
  const badgeId  = isActive ? 'popupHHTimer' : 'popupHHTimerNext';
  const timeId   = isActive ? 'popupHHTimerTime' : 'popupHHTimerNextTime';
  const dataAttr = isActive ? `data-hh-end="${hhEnd.toISOString()}"` : `data-hh-next="${hhNext.toISOString()}"`;
  const cls      = isActive ? 'popup-hh-timer' : 'popup-hh-timer upcoming';
  return `<span class="popup-hh-timer-wrap">
    <button type="button" class="${cls}" id="${badgeId}" ${dataAttr} onclick="toggleHHSchedule(event,'${widgetId}')">
      <span class="popup-hh-timer-label">Happy Hour</span><span class="popup-hh-timer-time" id="${timeId}"></span><i class="material-symbols-outlined popup-hh-timer-arrow">expand_more</i>
    </button>
    ${buildHHScheduleHTML(hhSlots || [], widgetId)}
  </span>`;
}

// Opens/closes the schedule dropdown attached to a tapped HH badge. Only
// one dropdown is ever open at a time. event.stopPropagation() keeps this
// from also triggering dealPopupCardClick()'s card-wide tap handler (which
// already skips real buttons, but belt-and-suspenders since this sits
// inside a floated corner column). The badge itself also gets the 'open'
// class so its chevron (.popup-hh-timer-arrow) flips to point up while
// the dropdown is showing — see styles.css.
function toggleHHSchedule(event, widgetId) {
  event.stopPropagation();
  const dropdown = document.getElementById(widgetId);
  if (!dropdown) return;
  const btn = event.currentTarget;
  const willOpen = !dropdown.classList.contains('open');
  document.querySelectorAll('.hh-schedule-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.popup-hh-timer.open').forEach(b => b.classList.remove('open'));
  dropdown.classList.toggle('open', willOpen);
  if (btn) btn.classList.toggle('open', willOpen);
}

// Tapping anywhere outside an open schedule dropdown closes it.
document.addEventListener('click', e => {
  if (e.target.closest('.popup-hh-timer-wrap')) return;
  document.querySelectorAll('.hh-schedule-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.popup-hh-timer.open').forEach(b => b.classList.remove('open'));
});

// Discounts/deals popups can combine a Deal offer section and a Local
// Price section, stacked with a divider (see buildPopupHTML() inside
// renderDealMarkers() below, .popup-section-deal / .popup-section-price).
// A combined card is left to grow to its natural (uncapped) height —
// the pin card's 3-stop sheet (map.js: getPinCardStops()/setPinCardStop())
// is what now handles showing a partial vs. full view: 'half' shows a
// consistent preview regardless of section count, and dragging up to
// 'full' is how the rest of a combo card's second section becomes
// visible. (An earlier version capped combo cards to a fixed height with
// their own internal scroll — that fought the sheet's own height
// measurement, since it shrank what the sheet saw as the card's real
// content height, so 'full' ended up barely bigger than 'half'.)

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

      // Price info (and its hhEnd) is computed up front — even though its
      // own section renders after the deal section below — because the HH
      // countdown badge now sits in the top-right grid cell (see
      // .popup-top-grid / buildDealOfferHTML() above) rather than floating
      // over the card's corner, so we need hhEnd in hand before building
      // whichever section has that header.
      let priceInfo = null;
      if (priceGroup) {
        const curItems = priceGroup.items.filter(isItemVisible);
        priceInfo = buildPriceInfoHTML(curItems);
      }
      const hhEnd   = priceInfo ? priceInfo.hhEnd   : null;
      const hhNext  = priceInfo ? priceInfo.hhNext  : null;
      const hhSlots = priceInfo ? priceInfo.hhSlots : [];
      // Renders the active "time left" badge, the lighter "time till" badge,
      // or nothing at all, depending on the venue's happy-hour data — see
      // buildHHBadgeHTML() above.
      const hhBadgeHtml = buildHHBadgeHTML(hhEnd, hhNext, hhSlots);

      if (dealGroup) {
        // Badge only goes on the first deal's name row — a venue with
        // several stacked deal offers shouldn't repeat the same countdown.
        html += '<div class="popup-section popup-section-deal">' + dealGroup.deals
          .map((d, i) => buildDealOfferHTML(d, i === 0 ? hhBadgeHtml : ''))
          .join('<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>') + '</div>';
      }
      if (priceGroup) {
        const { rowsHtml, extraInfo } = priceInfo;
        if (dealGroup) html += '<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>';
        html += '<div class="popup-section popup-section-price">';
        if (!dealGroup) {
          // Same CSS-Grid header/hours/carousel treatment as the deal-offer
          // card (buildDealOfferHTML() above) — kind:'price' + the
          // already-encoded safeKey routes Info/Edit/Save at the local
          // price rather than a deal (see buildVenueTopActionsHTML() /
          // buildVenueActionsCarouselHTML() / popupEditLocalPriceClick()).
          const priceCatLabel = firstCategoryLabel(priceGroup.p.item_category_first);
          html += `<div class="popup-top-grid">`
               +  `<div class="popup-top-left"><div class="popup-name">${escHTML(businessName)}</div>${priceCatLabel ? `<div class="popup-detail">${escHTML(priceCatLabel)}</div>` : ''}</div>`
               +  `<div class="popup-top-right">${hhBadgeHtml}${buildVenueTopActionsHTML(safeKey, 'price')}</div>`
               +  `</div>`
               +  buildHoursWidgetHTML(priceGroup.p.opening_hours_json, priceGroup.p.opening_hours || priceGroup.p.availability, 'popupHoursWidget')
               +  buildVenueActionsCarouselHTML(lat, lng, businessName, priceGroup.p.address, safeKey, 'price');
        }
        html += `<table style="width:100%;margin:8px 0;">${rowsHtml}</table>${extraInfo}<div style="text-align:center;"><button class="popup-btn" style="display:inline-block;margin-top:6px;" onclick="openLocalPriceDetail(decodeURIComponent('${safeKey}'))">View more</button></div>`;
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    const marker = L.marker([lat,lng],{icon, zIndexOffset: zOffset}).addTo(dealMap);
    marker._hiveVenueKey = key; // lets other code (e.g. search-select) find this exact marker
    if (priceGroup) marker._hivePriceKey = key; // used by refreshPricePinLabels() — only meaningful when a price component exists
    marker._hiveBuildPopup = buildPopupHTML;
    // hideClose: no ✕ button — dismiss by tapping the map or dragging the
    // card down instead. blurBackdrop + dragHandle: see styles.css / map.js.
    // onOpen starts the happy-hour countdown badge if the popup has one.
    // map.js's closePinCard() stops the timer. A combo (deal+price) card's
    // second section isn't height-capped here — the sheet's own 'full'
    // stop is what reveals it (see the comment above buildPopupHTML() /
    // renderDealMarkers()).
    marker.on('click', () => openPinCard(marker._hiveBuildPopup(), {
      hideClose: true, blurBackdrop: true, dragHandle: true,
      onOpen: () => { startPopupHHTimer(); }
    }));
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

  renderDealMarkers(f, singleType || 'all', getCurrentDealsOverridePrices());
  renderDealsList(f);
}

// Derives the item-level override list for the currently active Main
// Category (currentDealsType) + Sub Category (currentSubFilter) selection.
// Shared by filters.js (applyAdvFilter, when the drawer's Apply button is
// hit) and map.js (refreshPricePinLabels' periodic full re-render) so both
// reproduce the exact same filtered pin/card contents — instead of the
// periodic refresh silently reverting pins to "all items" every time a
// happy-hour window opens/closes.
function getCurrentDealsOverridePrices() {
  if (currentDealsType === 'all' || !currentSubFilter.length) return undefined;
  const sliderInput = document.getElementById('priceRangeInput');
  const sliderVal = sliderInput ? parseInt(sliderInput.value) : NaN;
  return _allPricesMaster.filter(p => {
    const matchCat = normalizePriceCat(p.item_category_first) === currentDealsType;
    const matchItem = currentSubFilter.includes((p.item_name||'').trim());
    const matchPrice = isNaN(sliderVal) ? true : parseFloat(p.price_normal||0) <= sliderVal;
    return matchCat && matchItem && matchPrice;
  });
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



