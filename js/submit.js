// ╔═══════════════════════════════════════════════════════════╗
// ║  SUBMIT — Add Farm / Deal / Price / Tip, Delete Requests ║
// ╚═══════════════════════════════════════════════════════════╝

// ── SUBMIT MODAL ──
let lockedType = null;

function openSubmit(fromPage) {
  if (!currentUser) { openAuthGate(fromPage); return; }
  document.getElementById('submitModal').classList.add('open');
  const page = fromPage || currentPage;
  lockedType = PAGE_TYPE_MAP[page] || null;

  const typeGroup = document.getElementById('typeSelectGroup');
  document.querySelectorAll('.type-option[data-type]').forEach(o => {
    o.classList.remove('selected','locked');
    if (lockedType) {
      if (o.dataset.type === lockedType) o.classList.add('selected');
      else o.classList.add('locked');
    }
  });

  if (lockedType) {
    typeGroup.style.display = 'none';
  } else {
    typeGroup.style.display = '';
    document.querySelector('.type-option[data-type]').classList.add('selected');
  }

  updateFormForType(lockedType || 'farm');
  // Reset price items, HH and LD for fresh submission
  const prc = document.getElementById('priceRowsContainer');
  if (prc) prc.innerHTML = `<div class="price-row"><input type="text" class="form-input item-name" placeholder="e.g. Heineken" oninput="refreshItemScopeDropdowns()"><input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01"></div>`;
  const hhs = document.getElementById('hhSlots');
  if (hhs) hhs.innerHTML = '';
  ldType = 'none';
  setTimeout(initPickerMap, 350);
}

// ── AUTH GATE — shown instead of the submit modal when signed out ──
let authGateReturnPage = null;

function openAuthGate(fromPage) {
  authGateReturnPage = fromPage || currentPage;
  document.getElementById('authGateOverlay').classList.add('open');
}

function closeAuthGate() {
  document.getElementById('authGateOverlay').classList.remove('open');
}

function authGateContinue() {
  closeAuthGate();
  openLaunchPage();
}

// ── Generic guard for any submission action — wrap a trigger's onclick with
// requireAuth(fn) and it'll show the sign-in popup instead of running fn()
// when nobody's logged in. e.g. onclick="requireAuth(submitNewPost)"
function requireAuth(fn) {
  if (!currentUser) { openAuthGate(); return; }
  fn();
}

function closeSubmit() {
  document.getElementById('submitModal').classList.remove('open');
  // Reset tristate farm fields
  ['farmFieldAccom', 'farmField88', 'farmFieldOrganic'].forEach(id => pickTri(id, 'unknown'));
  // Reset season month buttons
  const seasonGrid = document.getElementById('farmFieldSeasonMonths');
  if (seasonGrid) seasonGrid.querySelectorAll('.month-btn').forEach(b => b.classList.remove('on'));
  const seasonHidden = document.getElementById('farmFieldSeason');
  if (seasonHidden) seasonHidden.value = '';
  // Reset farm category pickers
  document.querySelectorAll('[data-fcat]').forEach(b => b.classList.remove('on'));
  document.getElementById('farmCategorySecondGroup').style.display = 'none';
  document.getElementById('farmCatSecondPills').innerHTML = '';
  const farmCatCustom = document.getElementById('farmCatSecondCustom');
  if (farmCatCustom) { farmCatCustom.style.display = 'none'; farmCatCustom.value = ''; }
  // Reset fb link field
  const fbLinkInput = document.getElementById('fieldFbLink');
  if (fbLinkInput) fbLinkInput.value = '';
  const fbGroup = document.getElementById('fbLinkGroup');
  if (fbGroup) fbGroup.style.display = 'none';
  // Reset HH slots
  const hhSlots = document.getElementById('hhSlots');
  if (hhSlots) hhSlots.innerHTML = '';
  // Reset LD
  ldType = 'none';
  const ldVal = document.getElementById('ldValue');
  if (ldVal) ldVal.value = '';
  const ldValueRow = document.getElementById('ldValueRow');
  if (ldValueRow) ldValueRow.style.display = 'none';
  ['Percent','Fixed','None'].forEach(t => {
    const btn = document.getElementById('ldType'+t);
    if (btn) btn.classList.toggle('active', t === 'None');
  });
  // Remove dynamically injected scope block
  const scopeBlock = document.getElementById('ldScopeBlock');
  if (scopeBlock) scopeBlock.remove();
}
function handleBackdropClick(e) { if (e.target === document.getElementById('submitModal')) closeSubmit(); }

function selectType(el) {
  if (lockedType) return;
  document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  updateFormForType(el.dataset.type);
}

function updateFormForType(type) {
  const ag = document.getElementById('availGroup');
  const stdGroup = document.getElementById('standardDetailsGroup');
  const priceGroup = document.getElementById('priceItemsGroup');
  const priceCatGroup = document.getElementById('priceCategoryGroup');
  const farmFields = document.getElementById('farmFieldsGroup');
  const fbGroup = document.getElementById('fbLinkGroup');
  const dl = document.getElementById('detailsLabel');
  const fd = document.getElementById('fieldDetails');

  if (ag) ag.style.display = 'none'; // availability section removed
  farmFields.style.display = (type === 'farm') ? '' : 'none';
  // Show Facebook link for farm and deal types
  if (fbGroup) fbGroup.style.display = (type === 'farm' || type === 'deal') ? '' : 'none';

  if (type === 'price') {
    stdGroup.style.display = 'none';
    priceGroup.style.display = 'block';
    priceCatGroup.style.display = 'block';
  } else {
    stdGroup.style.display = 'block';
    priceGroup.style.display = 'none';
    priceCatGroup.style.display = 'none';
    // Reset price category selection when switching away
    document.querySelectorAll('[data-pcat]').forEach(b => b.classList.remove('selected'));
    if (type==='farm')  { dl.textContent='Additional Details'; fd.placeholder='Any other info: crops, conditions, season…'; }
    else if (type==='deal')  { dl.textContent='Discount details'; fd.placeholder='e.g. 15% off coffee, how to redeem…'; }
    else { dl.textContent='Your tip'; fd.placeholder='Share useful info with the community…'; }
  }
}

function openFbSearch(type) {
  // Opens Facebook search in a new tab
  // Facebook deprecated /groups/search/ and /search/pages/ — use /search/top/ with a keyword hint
  const nameVal = (document.getElementById('fieldName') || {}).value || '';
  const base = nameVal.trim();
  if (type === 'groups') {
    const q = encodeURIComponent(base ? base + ' group' : 'backpackers farm group');
    window.open('https://www.facebook.com/search/top/?q=' + q + '&filters=eyJncm91cHMiOiJ7XCJuYW1lXCI6XCJncm91cHNcIn0ifQ%3D%3D', '_blank', 'noopener');
  } else {
    const q = encodeURIComponent(base ? base + ' page' : 'backpackers farm page');
    window.open('https://www.facebook.com/search/top/?q=' + q + '&filters=eyJwYWdlcyI6IntcIm5hbWVcIjpcInBhZ2VzXCJ9In0%3D', '_blank', 'noopener');
  }
}

function selectPriceCat(el) {
  document.querySelectorAll('[data-pcat]').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

// ── FARM CATEGORY SUB-TYPES ──
// Derived from existing farm_category_second / farm_category_third values in the DB,
// grouped by their farm_category_first parent.
const FARM_SUBTYPES = {
  'Livestock':          ['Livestock Breeder','Cattle Farm','Ranch','Station','Sheeps Farm','Alpacas Farm','Horse Stud','Pigs Farm','Goats Farm','Deer Farm','Emus/Ostriches Farm','Camel Farm','Donkey Farm'],
  'Plants & Nursery':   ['Plants Nursery','Wholesale Plant','Christmas Tree','Tree Plantation'],
  'Fruits & Orchards':  ['Orchard','Berries Farm','Apples Farm','Grapes Farm','Olive Farm','Citrus Farm','Mangoes Farm','Strawberry Farm','Cherries Farm','Banana Farm','Avocado Farm','Nuts Farm','Fruits Farm'],
  'Vineyard & Winery':  ['Vineyard'],
  'Vegetables & Crops': ['Vegetables Farm','Flowers Farm','Mushrooms Farm','Grains Farm','Nuts Farm','Seafood Farm','Cottons Farm'],
  'Honey':              ['Honey Farm'],
  'Poultry & Eggs':     ['Poultry Farm','Eggs Farm'],
  'Aquaculture':        ['Oyster Supplier','Aquaculture Farm','Fish Farm','Pearls Farm'],
  'Dairy':              ['Dairy Farm'],
  'Mixed & Specialty':  ['Roadhouses','Medicinal Cannabis Farm','Mixed Farm'],
  'Others':             ['Other Farm'],
};

function selectFarmCat(el) {
  document.querySelectorAll('[data-fcat]').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  _renderFarmSubtypePills(el.dataset.fcat);
}

function _renderFarmSubtypePills(cat) {
  const group = document.getElementById('farmCategorySecondGroup');
  const container = document.getElementById('farmCatSecondPills');
  const customInput = document.getElementById('farmCatSecondCustom');
  // Always reset custom input when category changes
  if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
  const subtypes = FARM_SUBTYPES[cat] || [];
  if (!subtypes.length) { group.style.display = 'none'; return; }
  container.innerHTML = subtypes.map(s =>
    `<button type="button" class="hh-day-btn" data-fcat2="${s}" onclick="selectFarmCatSecond(this)">${s}</button>`
  ).join('');
  group.style.display = '';
}

function selectFarmCatSecond(el) {
  // Toggle: tap again to deselect
  const wasOn = el.classList.contains('on');
  document.querySelectorAll('[data-fcat2]').forEach(b => b.classList.remove('on'));
  const customInput = document.getElementById('farmCatSecondCustom');
  if (!wasOn) {
    el.classList.add('on');
    // Show free-text field only when "Other Farm" is selected
    if (customInput) {
      const isOther = el.dataset.fcat2 === 'Other Farm';
      customInput.style.display = isOther ? '' : 'none';
      if (isOther) setTimeout(() => customInput.focus(), 50);
      else customInput.value = '';
    }
  } else {
    // Deselected — hide custom input
    if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
  }
}

// ── Edit Farm: category helpers (scoped to [data-efcat] to avoid collisions) ──
function selectEditFarmCat(el) {
  document.querySelectorAll('[data-efcat]').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  _renderEditFarmSubtypePills(el.dataset.efcat, '');
}

function _renderEditFarmSubtypePills(cat, preselect) {
  const group       = document.getElementById('editFarmCategorySecondGroup');
  const container   = document.getElementById('editFarmCatSecondPills');
  const customInput = document.getElementById('editFarmCatSecondCustom');
  if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
  const subtypes = FARM_SUBTYPES[cat] || [];
  if (!subtypes.length) { group.style.display = 'none'; return; }
  container.innerHTML = subtypes.map(s =>
    `<button type="button" class="hh-day-btn${preselect === s ? ' on' : ''}" data-efcat2="${s}" onclick="selectEditFarmCatSecond(this)">${s}</button>`
  ).join('');
  // If preselected value wasn't in the list (e.g. custom text), show custom input
  if (preselect && !subtypes.includes(preselect)) {
    container.innerHTML += `<button type="button" class="hh-day-btn on" data-efcat2="Other Farm" onclick="selectEditFarmCatSecond(this)">Other Farm</button>`;
    if (customInput) { customInput.style.display = ''; customInput.value = preselect; }
  }
  group.style.display = '';
}

function selectEditFarmCatSecond(el) {
  const wasOn = el.classList.contains('on');
  document.querySelectorAll('[data-efcat2]').forEach(b => b.classList.remove('on'));
  const customInput = document.getElementById('editFarmCatSecondCustom');
  if (!wasOn) {
    el.classList.add('on');
    if (customInput) {
      const isOther = el.dataset.efcat2 === 'Other Farm';
      customInput.style.display = isOther ? '' : 'none';
      if (isOther) setTimeout(() => customInput.focus(), 50);
      else customInput.value = '';
    }
  } else {
    if (customInput) { customInput.style.display = 'none'; customInput.value = ''; }
  }
}

function addPriceRow() {
  const container = document.getElementById('priceRowsContainer');
  const row = document.createElement('div');
  row.className = 'price-row';
  row.innerHTML = `
    <input type="text" class="form-input item-name" placeholder="e.g. Pint of beer" oninput="refreshItemScopeDropdowns()">
    <input type="number" class="form-input item-price" placeholder="Normal price ($)" step="0.01">
  `;
  container.appendChild(row);
  refreshItemScopeDropdowns();
}

// ── HAPPY HOUR SLOTS ──
const HH_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let ldType = 'none';

function getItemNamesFromForm(containerSelector) {
  const names = [];
  document.querySelectorAll(containerSelector + ' .item-name').forEach(inp => {
    const v = inp.value.trim();
    if (v) names.push(v);
  });
  return names;
}

// ── ITEM SCOPE MULTI-PICKER ──
// Builds a row of toggle pill-buttons for item selection (multi-choice).
// "All items" pill deselects everything else; individual pills deselect "All".
// The container must have class hh-item-scope-wrap (for HH slots)
// or id ldItemScopeWrap / editLDItemScopeWrap (for LD).

function buildItemScopePills(names, selectedArr, wrapClass) {
  // selectedArr: [] means "all items"
  const allActive = !selectedArr || selectedArr.length === 0;
  let html = `<div class="${wrapClass} scope-pill-wrap">`;
  html += `<button type="button" class="hh-day-btn scope-all-btn${allActive ? ' on' : ''}" onclick="toggleScopeAll(this)">All items</button>`;
  names.forEach(n => {
    const active = !allActive && selectedArr.includes(n);
    html += `<button type="button" class="hh-day-btn scope-item-btn${active ? ' on' : ''}" data-item="${n.replace(/"/g,'&quot;')}" onclick="toggleScopeItem(this)">${n}</button>`;
  });
  html += '</div>';
  return html;
}

function toggleScopeAll(btn) {
  const wrap = btn.closest('.scope-pill-wrap');
  wrap.querySelectorAll('.scope-item-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function toggleScopeItem(btn) {
  const wrap = btn.closest('.scope-pill-wrap');
  wrap.querySelector('.scope-all-btn').classList.remove('on');
  btn.classList.toggle('on');
  // If nothing selected, revert to "All"
  const anyOn = [...wrap.querySelectorAll('.scope-item-btn')].some(b => b.classList.contains('on'));
  if (!anyOn) wrap.querySelector('.scope-all-btn').classList.add('on');
}

function getScopeFromWrap(wrap) {
  if (!wrap) return [];
  if (wrap.querySelector('.scope-all-btn.on')) return []; // empty = all items
  return [...wrap.querySelectorAll('.scope-item-btn.on')].map(b => b.dataset.item);
}

function refreshItemScopePills() {
  const names = getItemNamesFromForm('#priceRowsContainer');
  // HH slots
  document.querySelectorAll('#hhSlots .hh-item-scope-wrap').forEach(wrap => {
    const cur = getScopeFromWrap(wrap);
    wrap.outerHTML = buildItemScopePills(names, cur, 'hh-item-scope-wrap');
  });
  // LD scope
  const ldWrap = document.getElementById('ldItemScopeWrap');
  if (ldWrap) {
    const cur = getScopeFromWrap(ldWrap);
    ldWrap.outerHTML = buildItemScopePills(names, cur, 'hh-item-scope-wrap').replace('hh-item-scope-wrap','hh-item-scope-wrap').replace('<div class="hh-item-scope-wrap', '<div id="ldItemScopeWrap" class="hh-item-scope-wrap');
  }
}

function refreshEditItemScopePills() {
  const names = getItemNamesFromForm('#editLPRows');
  document.querySelectorAll('#editLPHHSlots .hh-item-scope-wrap').forEach(wrap => {
    const cur = getScopeFromWrap(wrap);
    wrap.outerHTML = buildItemScopePills(names, cur, 'hh-item-scope-wrap');
  });
  const ldWrap = document.getElementById('editLDItemScopeWrap');
  if (ldWrap) {
    const cur = getScopeFromWrap(ldWrap);
    ldWrap.outerHTML = buildItemScopePills(names, cur, 'hh-item-scope-wrap').replace('<div class="hh-item-scope-wrap', '<div id="editLDItemScopeWrap" class="hh-item-scope-wrap');
  }
}

// Keep old names as aliases so any existing calls don't break
function refreshItemScopeDropdowns() { refreshItemScopePills(); }
function refreshEditItemScopeDropdowns() { refreshEditItemScopePills(); }

function addHHSlot() {
  const container = document.getElementById('hhSlots');
  const names = getItemNamesFromForm('#priceRowsContainer');
  const div = document.createElement('div');
  div.className = 'hh-slot';
  div.innerHTML = `
    <div class="hh-day-row">${HH_DAYS.map(d=>`<button type="button" class="hh-day-btn on" data-day="${d}" onclick="toggleHHDay(this)">${d}</button>`).join('')}</div>
    <div class="hh-time-row">
      <input type="time" class="form-input hh-from" value="17:00">
      <span style="text-align:center;color:var(--text-light);font-size:12px;">to</span>
      <input type="time" class="form-input hh-to" value="19:00">
      <button type="button" class="remove-hh-btn" onclick="this.closest('.hh-slot').remove()"><i class="ti ti-x"></i></button>
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

function toggleHHDay(btn) { btn.classList.toggle('on'); }

function setLDType(type) {
  ldType = type;
  ['Percent','Fixed','None'].forEach(t => {
    document.getElementById('ldType'+t).classList.toggle('active', t.toLowerCase()===type);
  });
  const row = document.getElementById('ldValueRow');
  row.style.display = (type === 'none') ? 'none' : '';
  document.getElementById('ldValue').placeholder = type === 'percent' ? 'e.g. 20 (for 20% off)' : 'e.g. 9.50 (fixed price)';
  if (type !== 'none') {
    // Inject scope pills if not yet present
    let wrap = document.getElementById('ldItemScopeWrap');
    if (!wrap) {
      const names = getItemNamesFromForm('#priceRowsContainer');
      const pillHtml = buildItemScopePills(names, [], 'hh-item-scope-wrap').replace('<div class="hh-item-scope-wrap','<div id="ldItemScopeWrap" class="hh-item-scope-wrap');
      const label = document.createElement('div');
      label.id = 'ldScopeBlock';
      label.innerHTML = `<label style="font-size:11px;font-weight:600;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;display:block;margin:8px 0 4px;">Applies to</label>${pillHtml}`;
      row.appendChild(label);
    } else {
      refreshItemScopePills();
    }
  }
}

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getHHData() {
  const slots = [];
  document.querySelectorAll('#hhSlots .hh-slot').forEach(slot => {
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

// ═══════════════════════════════════════════════════════════════
// VALIDATION SUITE — all data consistency checks
// ═══════════════════════════════════════════════════════════════



// ╔═══════════════════════════════════════════════════════════╗
// ║  FORM VALIDATION — Prices, Happy Hour, Local Discount    ║
// ╚═══════════════════════════════════════════════════════════╝

// ── Price row validation ──
// Retourne un message d'erreur ou null.
function validatePriceRows(rows) {
  const seen = new Map(); // itemName (lowercase) → index
  let hasValid = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawName  = row.querySelector('.item-name')?.value.trim() || '';
    const rawPrice = row.querySelector('.item-price')?.value.trim();
    const itemName  = rawName.toLowerCase();
    const itemPrice = parseFloat(rawPrice);

    if (!rawName && !rawPrice) continue; // skip empty rows

    // Missing name
    if (!rawName) return `Row ${i+1}: item name is missing.`;

    // Missing or invalid price
    if (rawPrice === '' || isNaN(itemPrice)) return `"${rawName}": please enter a valid price.`;

    // Zero or negative price
    if (itemPrice <= 0) return `"${rawName}": price must be greater than $0.`;

    // Suspiciously high price (likely a typo)
    if (itemPrice > 9999) return `"${rawName}": price ($${itemPrice}) seems unusually high — please double-check.`;

    // Duplicate item in the same submission
    if (seen.has(itemName)) {
      return `Duplicate item: "${rawName}" appears twice (rows ${seen.get(itemName)+1} and ${i+1}). Remove the duplicate or merge the information.`;
    }
    seen.set(itemName, i);
    hasValid = true;
  }

  if (!hasValid) return 'Please add at least one item with a valid name and price.';
  return null;
}

// ── Local Discount validation ──
function validateLDData(ldType, ldValueEl, itemsMap) {
  if (!ldType || ldType === 'none') return null;

  const val = parseFloat(ldValueEl?.value);
  if (isNaN(val) || val <= 0) return 'Local discount: please enter a value greater than 0.';

  if (ldType === 'percent') {
    if (val >= 100) return `Local discount: ${val}% off is not valid (must be less than 100%).`;
    if (val > 90)   return `Local discount: ${val}% off seems very high — please double-check.`;
  }

  if (ldType === 'fixed') {
    if (itemsMap) {
      for (const [name, price] of itemsMap) {
        if (val >= price) return `Local discount: fixed price ($${val}) is greater than or equal to the normal price ($${price}) for "${name}". The discounted price would be $0 or negative.`;
      }
    }
  }

  return null;
}

// ── Happy Hour validation (main) ──
function validateHHSlots(hhSlotEls, priceRows) {
  const parsed = [];

  // Build a name→price map from item rows
  const itemsMap = new Map();
  if (priceRows) {
    priceRows.forEach(row => {
      const n = row.querySelector('.item-name')?.value.trim();
      const p = parseFloat(row.querySelector('.item-price')?.value);
      if (n && !isNaN(p) && p > 0) itemsMap.set(n, p);
    });
  }

  // Set of declared item names (to detect HH targeting a non-existent item)
  const declaredItems = new Set([...itemsMap.keys()].map(n => n.toLowerCase()));

  for (let i = 0; i < hhSlotEls.length; i++) {
    const slot = hhSlotEls[i];
    const days = [...slot.querySelectorAll('.hh-day-btn.on:not(.scope-all-btn):not(.scope-item-btn)')].map(b => b.dataset.day.toLowerCase());
    const from  = slot.querySelector('.hh-from').value;
    const to    = slot.querySelector('.hh-to').value;
    const price = parseFloat(slot.querySelector('.hh-price').value);
    const wrap  = slot.querySelector('.hh-item-scope-wrap');
    const item_scopes = getScopeFromWrap(wrap);

    // No day selected
    if (days.length === 0) {
      return `Happy Hour #${i+1}: please select at least one day.`;
    }

    // End time ≤ start time
    const fromMins = timeToMins(from);
    const toMins   = timeToMins(to);
    if (fromMins !== null && toMins !== null && toMins <= fromMins) {
      return `Happy Hour #${i+1}: end time (${to}) must be after start time (${from}).`;
    }

    // Missing or invalid HH price
    if (isNaN(price) || price <= 0) {
      return `Happy Hour #${i+1}: please enter a valid price (greater than $0).`;
    }

    // HH applied to an item not listed in price rows
    if (item_scopes.length > 0 && declaredItems.size > 0) {
      const unknowns = item_scopes.filter(s => !declaredItems.has(s.toLowerCase()));
      if (unknowns.length > 0) {
        return `Happy Hour #${i+1}: "${unknowns[0]}" is not listed in the price rows. Add it or update the selection.`;
      }
    }

    // HH price ≥ normal price
    const checkItems = item_scopes.length > 0 ? item_scopes : [...itemsMap.keys()];
    for (const itemName of checkItems) {
      const normalPrice = itemsMap.get(itemName);
      if (normalPrice !== undefined && price >= normalPrice) {
        return `Conflict (Happy Hour #${i+1}): the happy hour price ($${price}) for "${itemName}" is greater than or equal to the normal price ($${normalPrice}).\nThe happy hour price must always be lower than the normal price.`;
      }
    }

    parsed.push({ idx: i+1, days, from, fromMins, to, toMins, price, item_scopes });
  }

  // Exact duplicate slots
  for (let a = 0; a < parsed.length; a++) {
    for (let b = a + 1; b < parsed.length; b++) {
      const A = parsed[a], B = parsed[b];
      const sameDays  = A.days.length === B.days.length && A.days.every(d => B.days.includes(d));
      const sameTime  = A.from === B.from && A.to === B.to;
      const samePrice = A.price === B.price;
      const aAll = A.item_scopes.length === 0, bAll = B.item_scopes.length === 0;
      const sameItems = (aAll && bAll) || (aAll === bAll && A.item_scopes.every(s => B.item_scopes.includes(s)));
      if (sameDays && sameTime && samePrice && sameItems) {
        return `Happy Hour #${A.idx} and #${B.idx} are identical (same days, times, price, and items).\nPlease remove the duplicate.`;
      }
    }
  }

  // Conflicting overlap (same item, different prices on overlapping time window)
  for (let a = 0; a < parsed.length; a++) {
    for (let b = a + 1; b < parsed.length; b++) {
      const A = parsed[a], B = parsed[b];

      const commonDays = A.days.filter(d => B.days.includes(d));
      if (commonDays.length === 0) continue;

      const aAll = A.item_scopes.length === 0, bAll = B.item_scopes.length === 0;
      const commonItems = aAll && bAll ? ['all items']
        : aAll ? B.item_scopes
        : bAll ? A.item_scopes
        : A.item_scopes.filter(i => B.item_scopes.includes(i));
      if (commonItems.length === 0) continue;

      const overlapStart = Math.max(A.fromMins, B.fromMins);
      const overlapEnd   = Math.min(A.toMins,   B.toMins);
      if (overlapEnd <= overlapStart) continue;

      if (A.price !== B.price) {
        const fmt = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
        return `Conflict between Happy Hour #${A.idx} ($${A.price}) and #${B.idx} ($${B.price}):\n`
          + `• Items: ${commonItems.join(', ')}\n`
          + `• Common days: ${commonDays.join(', ')}\n`
          + `• Overlapping window: ${fmt(overlapStart)} → ${fmt(overlapEnd)}\n`
          + `The same item cannot have two different happy hour prices on the same time window.`;
      }
    }
  }

  return null; // ✅ all good
}

// ── Inline validation error banner ──
// Displays errors inline inside the modal sheet instead of a native alert().
function showValidationError(msg) {
  // Remove any previous banner
  document.querySelectorAll('.validation-error-banner').forEach(el => el.remove());

  const banner = document.createElement('div');
  banner.className = 'validation-error-banner';
  // escHTML the message before injecting — msg may contain user-typed item names (XSS fix)
  banner.innerHTML = `<i class="ti ti-alert-triangle" style="font-size:18px;flex-shrink:0;margin-top:1px;"></i><span>${escHTML(msg).replace(/\n/g,'<br>')}</span>`;

  // Insert before the submit button inside the active sheet
  const submitBtn = document.querySelector('.modal-backdrop.open .submit-btn')
                 || document.querySelector('.modal-backdrop.open [id$="SubmitBtn"]');
  if (submitBtn) {
    submitBtn.parentNode.insertBefore(banner, submitBtn);
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Fallback : alert natif
    alert('⚠️ ' + msg);
  }

  // Auto-dismiss after 10s
  setTimeout(() => banner.remove(), 10000);
}

function getLDData() {
  if (ldType === 'none') return null;
  const val = parseFloat(document.getElementById('ldValue').value);
  if (isNaN(val) || val <= 0) return null;
  const wrap = document.getElementById('ldItemScopeWrap');
  const item_scopes = getScopeFromWrap(wrap);
  return { type: ldType, value: val, ...(item_scopes.length ? {item_scopes} : {}) };
}




// ── MY SUBMISSIONS ──
// Shows the signed-in user their own submissions (pending/approved/rejected)
// with admin notes. Uses supaFetchOwn (config.js) so the request carries the
// user's own access token — required because RLS only allows a signed-in
// user to see rows where auth.uid() = user_id (submissions_select_own).
let _mySubmissions     = [];
let _mySubmissionsTab  = 'all';
let _mySubmissionsLoaded = false;

const MS_TYPE_LABELS = {
  farm: 'Farm', deal: 'Deal', deal_edit: 'Deal update',
  price: 'Local price', tip: 'Tip',
  delete_farm: 'Farm deletion', delete_deal: 'Deal deletion', delete_price: 'Price deletion',
};

async function openMySubmissions() {
  if (!currentUser) { openAuthGate('profile'); return; }
  goToRaw('mysubmissions');
  _mySubmissionsTab = 'all';
  document.querySelectorAll('#mySubmissionsTabs .forum-tab').forEach(t => t.classList.toggle('active', t.dataset.msstatus === 'all'));
  if (!_mySubmissionsLoaded) await loadMySubmissions();
  else renderMySubmissions();
}

async function loadMySubmissions() {
  const el = document.getElementById('mySubmissionsList');
  el.innerHTML = '<div class="map-loading"><div class="spinner"></div>Loading…</div>';
  try {
    _mySubmissions = await supaFetchOwn('submissions', 'order=submission_date.desc&limit=200');
    _mySubmissionsLoaded = true;
  } catch(e) {
    logError('loadMySubmissions', e);
    _mySubmissions = [];
  }
  renderMySubmissions();
}

function switchMySubmissionsTab(btn) {
  document.querySelectorAll('#mySubmissionsTabs .forum-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  _mySubmissionsTab = btn.dataset.msstatus;
  renderMySubmissions();
}

// Groups submissions sharing a batch_id (multi-item forms, e.g. Heineken +
// Corona added together) into single arrays, preserving the incoming
// (submission_date desc) order otherwise. Ungrouped rows (batch_id: null,
// including every submission made before this feature existed) each become
// their own one-item group, so the rendering path below is unchanged for them.
function groupMySubmissions(items) {
  const groups = [];
  const byBatch = {};
  items.forEach(s => {
    if (s.batch_id) {
      if (!byBatch[s.batch_id]) { byBatch[s.batch_id] = []; groups.push(byBatch[s.batch_id]); }
      byBatch[s.batch_id].push(s);
    } else {
      groups.push([s]);
    }
  });
  return groups;
}

// A batch's overall status: if every item in the group has the same
// admin_decision, use it; otherwise (only possible for older batches decided
// row-by-row before the admin-side cascade existed) treat it as "pending"
// since it isn't fully resolved yet — the badge separately shows "Mixed".
function groupDecision(group) {
  const decisions = new Set(group.map(s => s.admin_decision || 'pending'));
  return decisions.size === 1 ? [...decisions][0] : 'pending';
}

function renderMySubmissions() {
  const el = document.getElementById('mySubmissionsList');
  const groups = groupMySubmissions(_mySubmissions);
  const filteredGroups = _mySubmissionsTab === 'all'
    ? groups
    : groups.filter(g => groupDecision(g) === _mySubmissionsTab);

  if (!filteredGroups.length) {
    el.innerHTML = `<div class="no-posts" style="padding:28px 20px;text-align:center;color:var(--text-light);font-size:14px;">${
      _mySubmissionsTab === 'all' ? "You haven't submitted anything yet." : `No ${_mySubmissionsTab} submissions.`
    }</div>`;
    return;
  }

  el.innerHTML = filteredGroups.map(group => {
    const first     = group[0];
    const decision  = groupDecision(group);
    const isMixed   = new Set(group.map(s => s.admin_decision || 'pending')).size > 1;
    const statusCls = decision === 'approved' ? 'active' : decision === 'pending' ? 'pending' : '';
    const statusStyle = decision === 'rejected' ? 'background:#FBE9E7;color:#C0392B;' : '';
    const statusLabel = isMixed ? 'Mixed' : decision.charAt(0).toUpperCase() + decision.slice(1);
    const typeLabel = MS_TYPE_LABELS[first.type] || first.type;
    const when      = formatTimeAgo(first.submission_date);

    let title, body;
    if (group.length > 1) {
      const itemNames = group.map(s => s.item_name).filter(Boolean).join(', ');
      title = `${escHTML(first.business_name)} — ${group.length} items`;
      body  = `<div class="fp-preview" style="margin-top:4px;">${escHTML(itemNames)}</div>`;
    } else {
      title = first.item_name ? `${escHTML(first.business_name)} — ${escHTML(first.item_name)}` : escHTML(first.business_name);
      const price = first.item_price ? `<span class="fp-stat">$${parseFloat(first.item_price).toFixed(2)}</span>` : '';
      body  = `<div class="fp-footer">${price}</div>`;
    }

    const notesSource = (group.find(s => (s.admin_decision || 'pending') !== 'pending' && s.admin_notes) || {}).admin_notes;
    const notes = (decision !== 'pending' && notesSource)
      ? `<div class="fp-preview" style="margin-top:6px;font-style:italic;">${escHTML(notesSource.trim())}</div>`
      : '';

    return `<div class="forum-post">
      <div class="forum-post-header">
        <div class="fp-meta"><div class="fp-author">${title}</div><div class="fp-time">${typeLabel} · ${when}</div></div>
        <span class="deal-status ${statusCls}" style="${statusStyle}">${statusLabel}</span>
      </div>
      ${body}
      ${notes}
    </div>`;
  }).join('') + '<div class="scroll-pad"></div>';
}

// ── DELETE LISTING ──
let _deleteContext = null;

function openDeleteConfirm(type) {
  if (!currentUser) { openAuthGate(); return; }
  _deleteContext = type;
  const sub = document.getElementById('deleteConfirmSub');
  if (type === 'localprice') {
    sub.textContent = 'This will submit a deletion request for this local price listing. An admin will review it before it is removed.';
  } else if (type === 'farm') {
    sub.textContent = 'This will submit a deletion request for this farm. An admin will review it before it is removed.';
  } else if (type === 'deal') {
    sub.textContent = 'This will submit a deletion request for this deal. An admin will review it before it is removed.';
  }
  document.getElementById('deleteConfirmOverlay').classList.add('open');
}

function closeDeleteConfirm() {
  document.getElementById('deleteConfirmOverlay').classList.remove('open');
  _deleteContext = null;
}

async function confirmDelete() {
  if (!_deleteContext) return;
  if (!currentUser) { closeDeleteConfirm(); showToast('Sign in to request a deletion'); openLaunchPage(); return; }
  const type = _deleteContext;
  closeDeleteConfirm();

  let refId = null;
  let itemName = '';

  if (type === 'localprice') {
    // Fix #13: use actual DB ids instead of fragile composite key
    const lpKey = document.getElementById('editLocalPriceKey')?.value;
    const lpGroup = priceGroupsCache[lpKey];
    if (lpGroup && lpGroup.items && lpGroup.items.length) {
      // Store all item ids as pipe-separated list so admin can delete each by id
      refId = lpGroup.items.map(i => i.id).filter(Boolean).join('|');
    } else {
      refId = lpKey; // fallback to composite key for older submissions
    }
    itemName = 'local price listing';
    document.getElementById('editLocalPriceModal')?.classList.remove('open');
  } else if (type === 'farm') {
    refId = window.currentFarmId || null;
    itemName = 'farm';
    document.getElementById('editFarmModal')?.classList.remove('open');
  } else if (type === 'deal') {
    refId = currentDealId || null;
    itemName = 'deal';
    document.getElementById('editDealModal')?.classList.remove('open');
  }

  const submissionType = type === 'localprice' ? 'delete_price'
                       : type === 'deal'        ? 'delete_deal'
                       : 'delete_farm';

  try {
    await supaInsert('submissions', {
      type: submissionType,
      business_name: refId ? `DELETE REQUEST — ID: ${refId}` : `DELETE REQUEST`,
      details: `User requested deletion of ${itemName}${refId ? ' (ref: ' + refId + ')' : ''}`,
      target_id: refId || null,
      submitted_by_email: currentUser?.email || null,
    });
    showToast('Deletion request sent — an admin will review it ✓');
  } catch(e) {
    showToast(e?.message || 'Error sending request, please try again');
  }
}
