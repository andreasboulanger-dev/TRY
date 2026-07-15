// ╔═══════════════════════════════════════════════════════════╗
// ║  DEALS & LOCAL PRICES — Map, Detail, Edit, Submission   ║
// ╚═══════════════════════════════════════════════════════════╝

let currentLocalPriceKey = null;

let editLDType = 'none';

// Categories are multi-select (Bar + Café + Activities can all be on at
// once), except "Deal" — picking it clears every other category (it
// swaps the Items & Prices slide for a Discount form, which doesn't make
// sense combined with anything else); picking any other category while
// Deal is active turns Deal back off.
function selectEditLPCat(el) {
  const isDeal = el.dataset.lpcat === 'deal';
  if (isDeal) {
    document.querySelectorAll('[data-lpcat]').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  } else {
    document.querySelector('#editLocalPriceModal [data-lpcat="deal"]')?.classList.remove('selected');
    el.classList.toggle('selected');
  }
  // Picking "Deal" (or switching away from it) swaps the Items & Prices
  // slide for a plain Discount form, and relabels its menu row to match.
  refreshEditLPItemsOrDiscount();
}

// ── EDIT SHEET — hub/menu navigation ──
// Slide 0 is a Settings-style menu of five sections; tapping a row jumps
// straight to that section's own slide (goToEditLPSection) instead of
// stepping through a fixed order. Physical slide indices in
// #editLPCarouselTrack: 0 Menu, 1 Name, 2 Location, 3 Hours,
// 4 Categories, 5 Items & Prices (or Discount, for the "Deal" category).
// Submit lives on the menu slide itself.
const EDIT_LP_SLIDES = { menu: 0, name: 1, location: 2, hours: 3, categories: 4, items: 5 };
const EDIT_LP_TITLES = { 0: 'Edit', 1: 'Business name', 2: 'Location', 3: 'Hours', 4: 'Categories' };

// Single representative category — 'deal' if Deal is selected, otherwise
// the first of however many non-deal categories are selected. Used only
// to decide the Items-vs-Discount slide; use editLPSelectedCats() below
// for the full multi-select list to actually save.
function editLPActiveCat() {
  return document.querySelector('#editLocalPriceModal [data-lpcat].selected')?.dataset.lpcat || null;
}

// Every selected category's raw value, in menu order (Bar, Café, Deal,
// Activities, Hostel) — what actually gets comma-joined and saved.
function editLPSelectedCats() {
  return [...document.querySelectorAll('#editLocalPriceModal [data-lpcat].selected')].map(b => b.dataset.lpcat);
}

// Items & Prices (with its Happy Hour / Local Discount sub-sections) and
// the Deal's Discount form live on the same physical slide (5) and are
// toggled by display — so the menu keeps a single row that relabels
// itself instead of needing a 7th section just for deals.
function refreshEditLPItemsOrDiscount() {
  const isDeal = editLPActiveCat() === 'deal';
  document.getElementById('editLPItemsSection').style.display = isDeal ? 'none' : '';
  document.getElementById('editLPDiscountSection').style.display = isDeal ? '' : 'none';
  const icon = document.getElementById('editLPMenuIconItems');
  const label = document.getElementById('editLPMenuLabelItems');
  if (icon) icon.textContent = isDeal ? 'sell' : 'local_offer';
  if (label) label.textContent = isDeal ? 'Discount' : 'Items & Prices';
}

function goToEditLPPhysicalSlide(physIdx) {
  const st = _formCarouselState['editLP'];
  if (!st) return;
  st.idx = physIdx;

  const track = document.getElementById('editLPCarouselTrack');
  if (track) track.style.transform = `translateX(-${physIdx * 100}%)`;

  const isMenu = physIdx === EDIT_LP_SLIDES.menu;

  const titleEl = document.getElementById('editLPModalTitle');
  if (titleEl) {
    titleEl.textContent = physIdx === EDIT_LP_SLIDES.items
      ? (editLPActiveCat() === 'deal' ? 'Discount' : 'Items & Prices')
      : (EDIT_LP_TITLES[physIdx] || 'Edit');
  }

  document.getElementById('editLPDeleteBtn')?.classList.toggle('fc-hidden', !isMenu);
  document.getElementById('editLPNextBtn')?.classList.toggle('fc-btn-hidden', isMenu);
  document.getElementById('editLPSubmitBtn')?.classList.toggle('fc-btn-hidden', !isMenu);

  if (isMenu) refreshEditLPMenu();
  if (physIdx === EDIT_LP_SLIDES.location) setTimeout(() => editLPMap && editLPMap.invalidateSize(), 320);

  track?.closest('.modal-sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// Menu row tap — jump straight to that section's slide.
function goToEditLPSection(key) {
  const idx = EDIT_LP_SLIDES[key];
  if (idx !== undefined) goToEditLPPhysicalSlide(idx);
}

// Header "back" button: always returns to the menu from any section;
// only closes the sheet once the menu itself is showing.
function handleEditLPBack(onClose) {
  const st = _formCarouselState['editLP'];
  if (st && st.idx !== EDIT_LP_SLIDES.menu) goToEditLPPhysicalSlide(EDIT_LP_SLIDES.menu);
  else if (typeof onClose === 'function') onClose();
}

function initEditLPCarousel() {
  _formCarouselState['editLP'] = { idx: 0, count: 6 };
  refreshEditLPItemsOrDiscount();
  goToEditLPPhysicalSlide(EDIT_LP_SLIDES.menu);
}

// ── MENU — live subtitle values on the hub slide ──
function _editLPSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function refreshEditLPMenu() {
  const name = document.getElementById('editLPName')?.value.trim();
  _editLPSetText('editLPMenuValName', name || 'Not set');

  _editLPSetText('editLPMenuValLocation', document.getElementById('editLPLat')?.value ? 'Pin set' : 'Not set');

  const hoursJson = buildHoursJsonFromBlocks(document.getElementById('editLPHoursBlocks'));
  const openDayCount = hoursJson ? Object.keys(hoursJson).length : 0;
  _editLPSetText('editLPMenuValHours', openDayCount ? `${openDayCount} day${openDayCount > 1 ? 's' : ''} set` : 'Not set');

  const catBtns = [...document.querySelectorAll('#editLocalPriceModal [data-lpcat].selected')];
  const catLabels = catBtns.map(b => b.querySelector('span:not(.type-option-check)')?.textContent).filter(Boolean);
  _editLPSetText('editLPMenuValCat', catLabels.length ? catLabels.join(', ') : 'Not set');

  if (editLPActiveCat() === 'deal') {
    const disc = document.getElementById('editLPDealDiscount')?.value;
    _editLPSetText('editLPMenuValItems', disc ? disc + '% off' : 'Not set');
  } else {
    const count = document.querySelectorAll('#editLPRows .price-row').length;
    _editLPSetText('editLPMenuValItems', count ? count + ' item' + (count > 1 ? 's' : '') : 'Not set');
  }
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

// Suggests a starting business name from the address just picked or the
// pin's coordinates, without overwriting anything the person already
// typed. Called on every search-select / marker move (new or corrected
// location) on the collapsible "Change location" panel.
function suggestEditLPName(suggestedName) {
  const input = document.getElementById('editLPName');
  if (input && !input.value.trim() && suggestedName) input.value = suggestedName;
}


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
    suggestEditLPName(`${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`);
  });
  editLPMap.on('click', e => {
    editLPMarker.setLatLng(e.latlng);
    document.getElementById('editLPLat').value = e.latlng.lat.toFixed(5);
    document.getElementById('editLPLng').value = e.latlng.lng.toFixed(5);
    suggestEditLPName(`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
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
    suggestEditLPName(label.split(',')[0].trim());
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
  document.getElementById('editLPDealId').value = '';
  document.getElementById('editLPDealDiscount').value = '';
  document.getElementById('editLPDealDescription').value = '';
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
    document.getElementById('editLPDealId').value = '';
    document.getElementById('editLPName').value = p.business_name || '';

    // p.item_category_first can itself be a comma-separated list (see
    // firstCategoryLabel's comment) even though its name suggests one
    // value — split and normalize each token so every matching category
    // pill gets preselected, not just the first.
    const existingCats = (p.item_category_first || '').split(',').map(c => normalizePriceCat(c.trim())).filter(Boolean);
    document.querySelectorAll('[data-lpcat]').forEach(b => {
      b.classList.toggle('selected', existingCats.includes(b.dataset.lpcat));
    });

    const container = document.getElementById('editLPRows');
    container.innerHTML = items.map(i => `
      <div class="price-row">
        <input type="text" class="form-input item-name" placeholder="Item" value="${escHTML(i.item_name||'')}" oninput="refreshEditItemScopeDropdowns();updateEditLPRowCheck(this)">
        <input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01" value="${escHTML(String(i.price_normal||''))}" oninput="updateEditLPRowCheck(this)">
        <i class="material-symbols-outlined price-row-check" aria-hidden="true" title="Correct">check_circle</i>
      </div>`).join('');
    container.querySelectorAll('.price-row').forEach(row => updateEditLPRowCheck(row));

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
          last.querySelectorAll('.hh-day-row .hh-day-btn').forEach(b => {
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

  renderHoursBlocks(document.getElementById('editLPHoursBlocks'), p.opening_hours_json);

  initEditLPCarousel();
  document.getElementById('editLocalPriceModal').classList.add('open');
  setTimeout(() => initEditLPMap(lat, lng), 350);
}

function addEditLPRow() {
  const container = document.getElementById('editLPRows');
  const row = document.createElement('div');
  row.className = 'price-row';
  row.innerHTML = `
    <input type="text" class="form-input item-name" placeholder="e.g. Pint of beer" oninput="refreshEditItemScopeDropdowns();updateEditLPRowCheck(this)">
    <input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01" oninput="updateEditLPRowCheck(this)">
    <i class="material-symbols-outlined price-row-check" aria-hidden="true" title="Correct">check_circle</i>`;
  container.appendChild(row);
  refreshEditItemScopeDropdowns();
}

// Toggles the row's "Correct" check icon once both its item name and
// price are filled in with a valid, non-negative number — el can be
// either an input inside the row or the row itself.
function updateEditLPRowCheck(el) {
  const row = el.classList && el.classList.contains('price-row') ? el : el.closest('.price-row');
  if (!row) return;
  const name  = row.querySelector('.item-name')?.value.trim();
  const price = parseFloat(row.querySelector('.item-price')?.value);
  const valid = !!name && !isNaN(price) && price >= 0;
  row.classList.toggle('price-row-valid', valid);
}

async function submitLocalPriceEdit() {
  const name = document.getElementById('editLPName').value.trim();
  if (!name) { showToast('Please enter a business name'); return; }

  const selectedCats = editLPSelectedCats();
  if (!selectedCats.length) { showToast('Please select at least one category'); return; }

  if (selectedCats.includes('deal')) {
    await submitDealEditFromLP(name);
    return;
  }

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
  const editRef = document.getElementById('editLocalPriceKey').value;

  const openingHoursJson = buildHoursJsonFromBlocks(document.getElementById('editLPHoursBlocks'));

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
        item_category:     selectedCats.join(','),
        item_name:         row.itemName,
        item_price:        row.itemPrice,
        happy_hour_prices: hhData || null,
        local_discount:    ldData || null,
        opening_hours_json: openingHoursJson,
        details:           'EDIT OF: ' + editRef,
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

// ── DEAL EDIT ──
// Deals are edited through the same sheet as local prices (#editLocalPriceModal).
// This populates the shared fields (name, hours, location) plus the deal-only
// ones (editLPDealDiscount/editLPDealDescription), pre-selects the "Deal"
// category pill, and clears out the items/happy-hour/local-discount state
// that doesn't apply to a deal offer. See refreshEditLPItemsOrDiscount()
// above for how the "Deal" category swaps in the Discount form instead.
function openEditDeal() {
  if (!currentUser) { openAuthGate('deals'); return; }
  const d = allDeals.find(x => x.id === currentDealId);
  if (!d) return;

  document.getElementById('editLocalPriceKey').value = '';
  document.getElementById('editLPDealId').value       = d.id;
  document.getElementById('editLPName').value         = d.business_name || '';

  document.querySelectorAll('[data-lpcat]').forEach(b => {
    b.classList.toggle('selected', b.dataset.lpcat === 'deal');
  });

  // Items / Happy Hour / Local Discount don't apply to a deal — clear them out.
  document.getElementById('editLPRows').innerHTML = '';
  document.getElementById('editLPHHSlots').innerHTML = '';
  setEditLDType('none');

  document.getElementById('editLPDealDiscount').value    = parseFloat(d.discount || 0) || '';
  document.getElementById('editLPDealDescription').value = d.discount_description || '';

  renderHoursBlocks(document.getElementById('editLPHoursBlocks'), d.opening_hours_json);

  const lat = parseFloat(d.latitude) || -45.03;
  const lng = parseFloat(d.longitude) || 168.66;
  document.getElementById('editLPLat').value = lat;
  document.getElementById('editLPLng').value = lng;

  initEditLPCarousel();
  document.getElementById('editLocalPriceModal').classList.add('open');
  setTimeout(() => initEditLPMap(lat, lng), 350);
}

async function submitDealEditFromLP(name) {
  const dealId     = document.getElementById('editLPDealId').value;
  const cachedDeal = dealId && allDeals ? allDeals.find(d => d.id === dealId) : null;

  const _discount = document.getElementById('editLPDealDiscount').value.trim();
  const _desc     = document.getElementById('editLPDealDescription').value.trim();

  const openingHoursJson = buildHoursJsonFromBlocks(document.getElementById('editLPHoursBlocks'));

  const lat = parseFloat(document.getElementById('editLPLat').value) || (cachedDeal ? parseFloat(cachedDeal.latitude) : null);
  const lng = parseFloat(document.getElementById('editLPLng').value) || (cachedDeal ? parseFloat(cachedDeal.longitude) : null);

  const payload = {
    type:                  'deal_edit',
    business_name:         name,
    details:               dealId ? 'EDIT OF: ' + dealId : null,
    business_type:         cachedDeal ? cachedDeal.business_type : null,
    discount:              parseFloat(_discount) || null,
    discount_description:  _desc || null,
    opening_hours_json:    openingHoursJson,
    latitude:              lat,
    longitude:             lng,
    country:               cachedDeal ? cachedDeal.country      : null,
    state_region:          cachedDeal ? cachedDeal.state_region : null,
    city:                  cachedDeal ? cachedDeal.city         : null,
    address:               cachedDeal ? cachedDeal.address      : null,
    target_id:             dealId || null,
    submitted_by_email:    currentUser?.email || null,
    admin_decision:        'pending',
  };

  try {
    await supaInsert('submissions', payload);
    closeEditLocalPrice();
    setTimeout(() => showToast('Edit submitted — thanks! 🐝'), 300);
  } catch(e) {
    if (e?.message === 'Please sign in to submit.') { openAuthGate('deals'); return; }
    showToast('Error sending — please try again');
  }
}

// ── LOCAL PRICE (still used by the edit modal + map popups) ──
let priceGroupsCache = {};

const dealEmoji = {'coffee shop':'☕','hostel':'🛏️','bar':'🍺','restaurant':'🍽️','activity':'🏄','deal':'🏷️','default':'🏪'};
const dealColor = {'coffee shop':'#795548','hostel':'#1565C0','bar':'#D84315','restaurant':'#2E7D32','activity':'#6A1B9A','deal':'#00796B','default':'#D4851A'};
// Used instead of the category color for a venue that has no structured
// opening_hours_json at all — we can't tell open from closed, so the pin
// is shown "disabled" (greyed out) rather than either fully-colored or
// hidden. Matches the app's existing muted/secondary-text token so it
// reads as "disabled" consistently with the rest of the UI, light or dark.
const DISABLED_PIN_COLOR = 'var(--md-sys-color-on-surface-variant)';

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
// items (optional): this venue's local_prices rows (already
// isItemVisible-filtered), passed in only for the first deal in a combo
// (deal+price) card — see buildInfoMenuTabsHTML() below.
// deals (optional): the full array of deal offers at this venue — also only
// passed in for the first deal in a stacked group. Whenever it's present
// this call builds the shared Menu·Deals·Infos tab widget (the offer's own
// description/status/notes now live inside that widget's Deals panel
// instead of sitting below the card as their own section — see
// buildInfoMenuTabsHTML() below); when it's omitted (i > 0) no tab widget
// is built here at all, since the venue's one shared widget already lists
// every stacked deal.
//
// Card layout (CSS Grid, not float — see .popup-top-grid in styles.css):
//   ┌────────────────────┬──────────────────┐
//   │ Name                │  HH countdown    │
//   │ Category            │ Info·Saved·Edit  │
//   ├────────────────────┴──────────────────┤
//   │       Opening/closing hours (full width)      │
//   ├────────────────────────────────────────┤
//   │ ⇄ Directions · Share · Uber · Edit · Save (scroll) │
//   ├────────────────────────────────────────┤
//   │ Menu · Deals · Infos (full width)              │
//   └────────────────────────────────────────┘
function buildDealOfferHTML(d, hhBadgeHtml, items, deals) {
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
        ${buildVenueTopActionsHTML(d.id, 'deal', d)}
      </div>
    </div>
    ${buildHoursWidgetHTML(d.opening_hours_json, d.opening_hours || d.availability, 'popupHoursWidget')}
    ${buildVenueActionsCarouselHTML(lat, lng, d.business_name, d.address, d.id, 'deal')}
    ${deals ? buildInfoMenuTabsHTML(d, items, deals, 'popupInfoTabs') : ''}`;
}

// ── SOURCE / LAST-UPDATED INFO POPUP ──
// Attached to the "i" quick-action button (see buildVenueTopActionsHTML()
// below) — same anchored-dropdown pattern as the HH schedule popup
// (buildHHScheduleHTML()/toggleHHSchedule() further down this file):
// tapping the button toggles a small card, right-aligned under the button,
// showing where this venue's pricing/deal info came from and when it was
// last confirmed. venue is the already-flattened deal/local_prices row —
// flattenVenue() (utils.js) carries price_source/last_checked_at through
// from the linked venues row.
const SOURCE_LABELS = {
  claimed:      'Bar claimed',
  walk_in:      'Walk in',
  website:      'Website',
  crowdsourced: 'Crowdsourced',
};

function sourceLabelFor(venue) {
  return SOURCE_LABELS[venue?.price_source] || SOURCE_LABELS.crowdsourced;
}

function buildSourceInfoHTML(venue, widgetId) {
  const label    = sourceLabelFor(venue);
  const dateStr  = formatDateDMY(venue?.last_checked_at);
  // "By" row (last_checked_by) intentionally not shown — see flattenVenue()
  // comment in utils.js for where that field still comes from if it's
  // ever needed elsewhere.
  return `<div class="source-info-dropdown" id="${widgetId}">
    <div class="source-info-row"><span class="source-info-label">Source</span><span>${escHTML(label)}</span></div>
    ${dateStr ? `<div class="source-info-row"><span class="source-info-label">Last Updated</span><span>${escHTML(dateStr)}</span></div>` : ''}
  </div>`;
}

// Opens/closes the source-info dropdown attached to a tapped "i" button.
// Only one dropdown (of any kind — HH schedule or source info) is ever
// open at a time, same convention as toggleHHSchedule() below.
function toggleSourceInfo(event, widgetId) {
  event.stopPropagation();
  const dropdown = document.getElementById(widgetId);
  if (!dropdown) return;
  const btn = event.currentTarget;
  const willOpen = !dropdown.classList.contains('open');
  document.querySelectorAll('.source-info-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.hh-schedule-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.popup-hh-timer.open').forEach(b => b.classList.remove('open'));
  dropdown.classList.toggle('open', willOpen);
  if (btn) btn.classList.toggle('open', willOpen);
}

// Tapping anywhere outside an open source-info dropdown closes it (mirrors
// the HH-schedule outside-click handler below).
document.addEventListener('click', e => {
  if (e.target.closest('.popup-source-wrap')) return;
  document.querySelectorAll('.source-info-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ── TOP-RIGHT QUICK ACTIONS (Info / Saved·Loved / Edit) ──
// Sits in the top-right grid cell (.popup-top-right), stacked below the HH
// countdown badge when one is present. Shared by deal-offer cards and
// price-only cards — kind ('deal' | 'price') picks which edit modal Edit
// opens; id is the deal's row id for 'deal', or the (already
// encodeURIComponent'd, matching the existing safeKey convention below)
// venue key for 'price'. venue is the flattened deal/local_prices row,
// used to read price_source/last_checked_at for the Info button's attached
// popup (see buildSourceInfoHTML() above). Saved/Loved is a
// client-only toggle for now (stored in localStorage, same pattern as the
// forum's like buttons — see getLikedSet()/saveLikedSet() in forum.js);
// there's no `venue_saves` table yet, so this doesn't sync across devices.
function buildVenueTopActionsHTML(id, kind, venue) {
  const saved = isVenueSaved(id, kind);
  const editOnclick = kind === 'price'
    ? `popupEditLocalPriceClick('${id}')`
    : `popupEditDealClick('${id}')`;
  const sourceWidgetId = 'sourceInfo_' + Math.random().toString(36).slice(2, 9);
  return `<div class="popup-action-row">
    <span class="popup-source-wrap">
      <button class="popup-action-btn" onclick="event.stopPropagation();toggleSourceInfo(event,'${sourceWidgetId}')" title="Source & last updated" aria-label="Info">
        <i class="material-symbols-outlined">info</i>
      </button>
      ${buildSourceInfoHTML(venue, sourceWidgetId)}
    </span>
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

// ── MENU / DEALS / INFOS TABS ──
// Sits directly below the Directions/Share/Uber/Edit/Save quick-actions
// carousel above — a small underline-style tab bar (like a booking site's
// Overview/Prices/Reviews/About tabs), spread full-width across the sheet,
// switching between three content panes. Menu is always the tab shown open
// by default:
//   • Menu  — this venue's priced items, reusing the same ⚡ HH / 🏠 Local
//     Discount badges as elsewhere, sorted cheapest-to-priciest, followed
//     by a Source note (see sourceLabelFor()/buildSourceInfoHTML() above —
//     same claimed/walk_in/website/crowdsourced value as the "i" quick-
//     action popup) reminding people to double-check prices in person.
//     When this venue has no priced items yet, the panel shows a
//     "No Happy Hour yet" placeholder instead.
//   • Deals — this venue's active deal offer(s): each one's redeem
//     description, Active/Negotiating status, and any notes. When this
//     venue has no deal on offer, the panel shows a "No deals yet"
//     placeholder instead.
//   • Infos — the contact details already known for this venue (address,
//     phone, opening status, website), condensed onto one panel.
// All three tabs are always shown (never conditionally hidden) so the
// bar's width split stays consistent card to card.
// venue: a deal or local_prices row (already flattenVenue()'d, so
// address/contact_phone/website/opening_hours* all live directly on it).
// items (optional): local_prices rows for this same venue (already
// isItemVisible-filtered) — see buildDealOfferHTML() and the price-only
// popup branch below for the two call sites.
// deals (optional): deal rows for this same venue — see buildDealOfferHTML()
// and the price-only popup branch below.
// widgetId: fixed per call-site context (same convention as the hours
// widget's 'popupHoursWidget'/'dealHoursWidget' ids — only one map pin
// card is ever open at a time, so a shared id is safe) — lets
// switchPopupTab() below find the right tab bar/panels to toggle.
function buildInfoMenuTabsHTML(venue, items, deals, widgetId) {
  widgetId = widgetId || 'popupInfoTabs';
  const website = (venue.website && /^https?:\/\//i.test(venue.website.trim())) ? venue.website.trim() : null;
  const phone   = (venue.contact_phone && /^[\d\s+\-().]+$/.test(venue.contact_phone.trim())) ? venue.contact_phone.trim() : null;
  const address = venue.address || [venue.city, venue.country].filter(Boolean).join(', ');
  const websiteLabel = website ? website.replace(/^https?:\/\//i, '').replace(/\/$/, '') : '';

  // ── INFOS PANEL ──
  const infoLines = [];
  if (address) infoLines.push(`<div class="popup-info-line"><i class="material-symbols-outlined">location_on</i><span>${escHTML(address)}</span></div>`);
  if (phone)   infoLines.push(`<div class="popup-info-line"><i class="material-symbols-outlined">call</i><a href="tel:${escHTML(phone)}" onclick="event.stopPropagation();">${escHTML(phone)}</a></div>`);
  if (venue.opening_hours_json) {
    const status = getOpenStatus(venue.opening_hours_json);
    const hoursText = status.isOpen ? 'Open now' : 'Closed now';
    const changeText = status.verb ? ` · ${status.verb} ${status.time}${status.dayLabel ? ' ' + status.dayLabel : ''}` : '';
    infoLines.push(`<div class="popup-info-line"><i class="material-symbols-outlined">schedule</i><span>${escHTML(hoursText + changeText)}</span></div>`);
  } else if (venue.opening_hours || venue.availability) {
    infoLines.push(`<div class="popup-info-line"><i class="material-symbols-outlined">schedule</i><span>${escHTML(venue.opening_hours || venue.availability)}</span></div>`);
  }
  if (website) infoLines.push(`<div class="popup-info-line"><i class="material-symbols-outlined">language</i><a href="${escHTML(website)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">${escHTML(websiteLabel)}</a></div>`);

  const infosPanelBody = infoLines.length ? infoLines.join('') : '<span class="popup-info-empty">No contact details yet</span>';

  // ── MENU PANEL ──
  const hasMenu = !!(items && items.length);
  let menuPanelBody;
  if (hasMenu) {
    // Cheapest first — mirrors getLowestPrice()'s own HH/Local/normal
    // priority so the displayed price and the sort order always agree.
    const sortedItems = items.slice().sort((a, b) => {
      const priceA = getLowestPrice(a) || parseFloat(a.price_normal || 0) || 0;
      const priceB = getLowestPrice(b) || parseFloat(b.price_normal || 0) || 0;
      return priceA - priceB;
    });
    const rows = sortedItems.map(item => {
      const normal  = parseFloat(item.price_normal||0)||null;
      const hhPrice = getActiveHH(item);
      const ldPrice = getLDPrice(item);
      const best    = getLowestPrice(item);
      const priceVal = best || normal;
      const priceStr = priceVal ? '$' + priceVal.toFixed(2) : '';
      const badge = hhPrice && hhPrice === best
        ? '<span class="price-badge">\u26A1 HH</span>'
        : (ldPrice && ldPrice === best ? '<span class="price-badge ld">\uD83C\uDFE0 Local</span>' : '');
      return `<div class="popup-menu-row"><span class="popup-menu-item">${escHTML(item.item_name)}</span><span class="popup-menu-price">${escHTML(priceStr)}${badge}</span></div>`;
    }).join('');
    // Source note replaces the old "Visit website" link — pricing here can
    // come from the venue itself, a staff walk-in check, their website, or
    // app users, so every menu always says which and reminds people to
    // double-check before relying on it (see sourceLabelFor() above).
    const sourceNote = `<div class="popup-menu-source-note"><i class="material-symbols-outlined">info</i><span>Source: ${escHTML(sourceLabelFor(venue))}. Always check the prices with the establishment.</span></div>`;
    menuPanelBody = rows + sourceNote;
  } else {
    menuPanelBody = '<span class="popup-info-empty">No Happy Hour yet. Help us grow and talk about us.</span>';
  }

  // ── DEALS PANEL ──
  const hasDeals = !!(deals && deals.length);
  let dealsPanelBody;
  if (hasDeals) {
    dealsPanelBody = deals.map(dl => {
      const statusBadge = dl.status === 'approved'
        ? '<span class="popup-status-badge popup-status-active">Active</span>'
        : '<span class="popup-status-badge popup-status-neg">Negotiating</span>';
      return `<div>
        <p class="popup-desc" style="margin-bottom:6px;">${escHTML(dl.discount_description||'')}</p>
        <div class="popup-status-row">
          ${statusBadge}
          ${dl.notes?`<span class="popup-note">${escHTML(dl.notes)}</span>`:''}
        </div>
      </div>`;
    }).join('<div style="height:10px;border-top:0.5px solid var(--border);margin:8px 0;"></div>');
  } else {
    dealsPanelBody = '<span class="popup-info-empty">No deals yet. Help us grow and talk about us.</span>';
  }

  return `<div class="popup-tabs" id="${widgetId}">
    <div class="popup-tabs-bar">
      <button type="button" class="popup-tab-btn active" data-tab="menu" onclick="event.stopPropagation();switchPopupTab('${widgetId}','menu')">Menu</button>
      <button type="button" class="popup-tab-btn" data-tab="deals" onclick="event.stopPropagation();switchPopupTab('${widgetId}','deals')">Deals</button>
      <button type="button" class="popup-tab-btn" data-tab="infos" onclick="event.stopPropagation();switchPopupTab('${widgetId}','infos')">Infos</button>
    </div>
    <div class="popup-tab-panel active" data-panel="menu">${menuPanelBody}</div>
    <div class="popup-tab-panel" data-panel="deals">${dealsPanelBody}</div>
    <div class="popup-tab-panel" data-panel="infos">${infosPanelBody}</div>
  </div>`;
}

// Switches the active tab/panel within one popup-tabs widget (see
// buildInfoMenuTabsHTML() above). Scoped to the widget's own id so
// multiple tab widgets on the page (unlikely, but see the fixed-id note
// above) never cross-toggle each other.
function switchPopupTab(widgetId, tab) {
  const root = document.getElementById(widgetId);
  if (!root) return;
  root.querySelectorAll(':scope > .popup-tabs-bar > .popup-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  root.querySelectorAll(':scope > .popup-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
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

// Opens the edit-deal modal directly from the map popup — reuses
// openEditDeal() below, which reads the deal off `currentDealId` + the
// allDeals cache.
function popupEditDealClick(dealId) {
  if (!currentUser) { openAuthGate('deals'); return; }
  currentDealId = dealId;
  openEditDeal();
}

// Same idea for local prices — opens the edit-local-price modal directly
// from the map popup. encodedKey arrives already encodeURIComponent'd
// (see safeKey below), so it's decoded once here before being stashed on
// currentLocalPriceKey (openEditLocalPrice() below looks that up in
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

  // Store in cache for the edit-local-price modal — use _allPricesMaster
  // (never filtered); allPrices can be temporarily swapped by
  // filterPrices()/applySubFilter()
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

    // ── Opening-hours pin gating ──
    // dealGroup and priceGroup both flatten from the same `venues` row (see
    // flattenVenue() in utils.js), so opening_hours_json is identical either
    // way — prefer dealGroup the same way businessName/city/country do above,
    // just for consistency, not because the value would actually differ.
    //   - Structured hours + currently closed → pin shrinks to a small grey
    //     dot (still tappable — same popup as always, see makeDotPin() in
    //     map.js).
    //   - No structured hours at all (we can't tell open from closed)
    //     → pin still shows at full size, but greyed out/"disabled",
    //     including the category emoji itself.
    //   - Structured hours + currently open → unchanged, normal pin.
    const hoursJson = dealGroup ? dealGroup.deals[0].opening_hours_json : priceGroup.p.opening_hours_json;
    let pinDisabled = false;
    let pinDot = false;
    if (hoursJson) {
      const status = getOpenStatus(hoursJson);
      if (status && !status.isOpen) pinDot = true; // closed right now — shrink to a small grey dot
    } else {
      pinDisabled = true; // no open/close data at all
    }

    // Icon: prefer the deal's category glyph/color when a deal is present
    // (matches prior deals-only behavior); price pin style shows the $
    // label whenever price data exists, combined or not. A closed venue
    // (pinDot) skips all of this and just gets the small grey dot.
    let icon, zOffset = 0, hhBadge = null;
    if (pinDot) {
      icon = makeDotPin();
    } else if (priceGroup) {
      const t = dealGroup ? (dealGroup.deals[0].business_type||'').toLowerCase() : null;
      const emoji = (t && dealEmoji[t]) || dealEmoji[priceGroup.cat] || '💰';
      const color = pinDisabled ? DISABLED_PIN_COLOR : ((t && dealColor[t]) || dealColor[priceGroup.cat] || '#5C5750');
      const priceLabel = priceGroup.minPrice !== null ? `$${priceGroup.minPrice.toFixed(2)}` : '';
      // Happy-hour pin badge — shown whenever this venue has an active
      // window right now, however long is left (see makePricePin()/
      // updatePinHHBadge() in map.js, and _formatHHDuration() below for the
      // "Xm" vs "Xh Ym" vs "Xd Yh" formatting).
      const hhEnd = getSoonestHHEnd(priceGroup.visibleItems);
      const hhMsLeft = hhEnd ? hhEnd - new Date() : -1;
      if (hhMsLeft > 0) {
        hhBadge = { timeText: _formatHHDuration(hhMsLeft) };
      }
      icon = makePricePin(emoji, color, priceLabel, pinDisabled, hhBadge);
      zOffset = (globalMax !== null && globalMin !== null && globalMax > globalMin)
        ? Math.round((1 - (priceGroup.minPrice - globalMin) / (globalMax - globalMin)) * 1000)
        : 0;
    } else {
      const t = (dealGroup.deals[0].business_type||'').toLowerCase();
      const color = pinDisabled ? DISABLED_PIN_COLOR : (dealColor[t]||dealColor.default);
      icon = makePin(dealEmoji[t]||dealEmoji.default, color, pinDisabled);
    }

    // Builds popup HTML fresh each time (prices change with happy-hour windows)
    function buildPopupHTML() {
      // Tapping anywhere on the card fires the same action as its primary
      // button, if it has one — see dealPopupCardClick() below.
      let html = '<div class="popup-inner" onclick="dealPopupCardClick(event)">';

      // Price info (and its hhEnd) is computed up front — even though its
      // own section renders after the deal section below — because the HH
      // countdown badge now sits in the top-right grid cell (see
      // .popup-top-grid / buildDealOfferHTML() above) rather than floating
      // over the card's corner, so we need hhEnd in hand before building
      // whichever section has that header.
      let priceInfo = null;
      let curItems = null; // hoisted (not block-scoped) — the Menu card below needs it too
      if (priceGroup) {
        curItems = priceGroup.items.filter(isItemVisible);
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
        // The Menu card (items) is likewise only built once, alongside the
        // first deal — see buildInfoMenuTabsHTML() via buildDealOfferHTML().
        html += '<div class="popup-section popup-section-deal">' + dealGroup.deals
          .map((d, i) => buildDealOfferHTML(d, i === 0 ? hhBadgeHtml : '', i === 0 ? curItems : null, i === 0 ? dealGroup.deals : null))
          .join('<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>') + '</div>';
      }
      if (priceGroup) {
        if (dealGroup) html += '<div style="height:10px;border-top:0.5px solid var(--border);margin:10px 0;"></div>';
        html += '<div class="popup-section popup-section-price">';
        if (!dealGroup) {
          // Same CSS-Grid header/hours/carousel treatment as the deal-offer
          // card (buildDealOfferHTML() above) — kind:'price' + the
          // already-encoded safeKey routes Info/Edit/Save at the local
          // price rather than a deal (see buildVenueTopActionsHTML() /
          // buildVenueActionsCarouselHTML() / popupEditLocalPriceClick()).
          // No dealGroup at this venue, so the Menu·Deals·Infos widget's
          // Deals panel gets null — it renders its own "No deals yet"
          // placeholder (see buildInfoMenuTabsHTML()).
          const priceCatLabel = firstCategoryLabel(priceGroup.p.item_category_first);
          html += `<div class="popup-top-grid">`
               +  `<div class="popup-top-left"><div class="popup-name">${escHTML(businessName)}</div>${priceCatLabel ? `<div class="popup-detail">${escHTML(priceCatLabel)}</div>` : ''}</div>`
               +  `<div class="popup-top-right">${hhBadgeHtml}${buildVenueTopActionsHTML(safeKey, 'price', priceGroup.p)}</div>`
               +  `</div>`
               +  buildHoursWidgetHTML(priceGroup.p.opening_hours_json, priceGroup.p.opening_hours || priceGroup.p.availability, 'popupHoursWidget')
               +  buildVenueActionsCarouselHTML(lat, lng, businessName, priceGroup.p.address, safeKey, 'price')
               +  buildInfoMenuTabsHTML(priceGroup.p, curItems, null, 'popupInfoTabs');
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    const marker = L.marker([lat,lng],{icon, zIndexOffset: zOffset}).addTo(dealMap);
    marker._hiveVenueKey = key; // lets other code (e.g. search-select) find this exact marker
    if (priceGroup) marker._hivePriceKey = key; // used by refreshPricePinLabels() — only meaningful when a price component exists
    marker._hiveBuildPopup = buildPopupHTML;
    // Collapse the pin's "Happy hour" label down to just "⚡ Xm" 5s after
    // it first renders — same pattern as the popup card's own HH badge
    // (scheduleHHLabelCollapse() below), just a longer delay since this one
    // sits passively on the map rather than being opened deliberately.
    if (hhBadge) {
      const badgeEl = marker.getElement()?.querySelector('[data-hh-badge]');
      if (badgeEl) setTimeout(() => badgeEl.classList.add('collapsed'), 5000);
    }
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
      html += `<div class="deal-card" onclick="searchGoDeal('${escHTML(d.id)}')"><div class="deal-card-header"><div class="deal-logo">${icon}</div><div><div class="deal-name">${escHTML(d.business_name)}</div><div class="deal-type">${escHTML(d.business_type||'')}</div></div>${pct>0?`<div class="deal-discount">-${pct}%</div>`:''}</div><p class="deal-desc">${escHTML(d.discount_description||'')}</p><div class="deal-footer"><span class="deal-status ${d.status==='approved'?'active':'pending'}">${d.status==='approved'?'Active':'Negotiating'}</span>${d.notes?`<span class="deal-verify"><i class="material-symbols-outlined">info</i>${escHTML(d.notes)}</span>`:''}</div></div>`;
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



