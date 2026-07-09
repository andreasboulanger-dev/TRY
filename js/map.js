// ╔═══════════════════════════════════════════════════════════╗
// ║  MAP — Tile Layer Cache, Price Pin Refresh, Fly To       ║
// ╚═══════════════════════════════════════════════════════════╝

// ── TILE LAYER CACHE ──
// Per-map cache: _tileLayers[mapId][url] = L.tileLayer instance
// LIGHT_TILE_URL / DARK_TILE_URL / getTileUrl() / TILE_URL live in theme.js
const _tileLayers = {};

function _getOrCreateTile(map, url) {
  const id = map._leaflet_id;
  if (!_tileLayers[id]) _tileLayers[id] = {};
  if (!_tileLayers[id][url]) {
    _tileLayers[id][url] = L.tileLayer(url, {attribution: TILE_ATTR, maxZoom: 19});
  }
  return _tileLayers[id][url];
}

// ── Dynamic price pin refresh ──
// Every 30s: recompute the cheapest price for each price pin and update
// its label in-place (no full re-render, no flicker). Also re-renders
// if the set of active HH windows has changed (items flipping in/out).
let _lastHHState = '';

function getPriceLabel(visibleItems) {
  const prices = visibleItems.map(i => getLowestPrice(i)).filter(v => v !== null);
  const min = prices.length ? Math.min(...prices) : null;
  return min !== null ? `$${min.toFixed(2)}` : '';
}

function getHHStateSnapshot() {
  // A string that changes whenever any HH window opens or closes
  return allPrices.map(i => {
    const hh = getActiveHH(i);
    return `${i.id}:${hh !== null ? hh : 'off'}`;
  }).join('|');
}

function refreshPricePinLabels() {
  if (!window.dealMap || !priceGroupsCache) return;

  const hhState = getHHStateSnapshot();
  const hhChanged = hhState !== _lastHHState;
  _lastHHState = hhState;

  // If HH windows changed (items appear/disappear), do a full re-render
  if (hhChanged) {
    renderDealMarkers(currentFilteredDeals.length ? currentFilteredDeals : allDeals);
    return;
  }

  // Otherwise just update label text in-place for each price pin
  dealMarkers.forEach(marker => {
    const el = marker.getElement();
    if (!el) return;
    const labelEl = el.querySelector('[data-price-label]');
    if (!labelEl) return;
    const key = marker._hivePriceKey;
    if (!key || !priceGroupsCache[key]) return;
    const { items } = priceGroupsCache[key];
    const visibleItems = items.filter(isItemVisible);
    const newLabel = getPriceLabel(visibleItems);
    if (labelEl.textContent !== newLabel) {
      labelEl.textContent = newLabel;
      // Flash amber briefly to signal a price change
      labelEl.style.transition = 'background 0.3s';
      labelEl.style.background = '#D4851A';
      setTimeout(() => { labelEl.style.background = ''; }, 600);
    }
  });
}

let _priceRefreshInterval = null;

function startPriceRefresh() {
  if (_priceRefreshInterval) return;
  _priceRefreshInterval = setInterval(() => {
    refreshPricePinLabels();
  }, 30000);
}

function stopPriceRefresh() {
  clearInterval(_priceRefreshInterval);
  _priceRefreshInterval = null;
}

// Start refresh only when Deals page is active, stop otherwise
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPriceRefresh();
  else if (currentPage === 'deals') startPriceRefresh();
});

// ── PIN ICON BUILDERS ──
function makePin(emoji, color) {
  return L.divIcon({ className: '',
    html: `<div class="map-pin" style="background:${color}"><span class="map-pin-emoji">${emoji}</span></div>`,
    iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-38] });
}

function makePricePin(emoji, color, label) {
  // data-price-label lets refreshPricePinLabels() update the text in-place
  return L.divIcon({ className: '',
    html: `<div class="map-pin-wrap">
      <div class="map-pin" style="background:${color}"><span class="map-pin-emoji">${emoji}</span></div>
      <div class="map-price-label" data-price-label style="background:${color}">${label}</div>
    </div>`,
    iconSize:[36,54], iconAnchor:[18,36], popupAnchor:[0,-38] });
}


// ── FLY TO ──
function flyTo(map, lat, lng, zoom) {
  if (!map) return;
  map.flyTo([parseFloat(lat), parseFloat(lng)], zoom, {animate:true, duration:1});
}

// ── PIN CARD ──
// Replaces Leaflet's bindPopup(): tapping a pin opens this card instead,
// docked in the gap directly above the bottom nav. The current page's
// FABs are NOT hidden while it's open — they float in the gap just above
// the card instead (see #app.pin-card-open in styles.css, and the
// ResizeObserver script near the end of index.html that keeps the
// --pincard-offset variable in sync with the card's live height). The
// overlay behind the card has pointer-events:none so panning/dragging the
// map underneath doesn't get intercepted and won't close the card.
let _pinCardOpen = false;

function openPinCard(html, opts) {
  document.getElementById('pinCardBody').innerHTML = html;
  const card = document.getElementById('pinCard');
  card.classList.toggle('hide-close', !!(opts && opts.hideClose));
  // Drag is only live on cards opened with opts.dragHandle (gated in the
  // drag script below via this same class) — currently just the
  // Discounts/deals map popups.
  card.classList.toggle('show-handle', !!(opts && opts.dragHandle));
  // Frosted-glass look on the card itself (blur + translucency), not the
  // full-screen backdrop behind it.
  card.classList.toggle('frosted', !!(opts && opts.blurBackdrop));
  card.style.transform = ''; // clear any leftover drag offset from a previous card
  card.classList.add('open');
  document.getElementById('pinCardOverlay').classList.add('open');
  document.getElementById('app')?.classList.add('pin-card-open');
  document.getElementById('pinCardBody').scrollTop = 0;
  _pinCardOpen = true;
  if (opts && typeof opts.onOpen === 'function') opts.onOpen();
}

function closePinCard() {
  const card = document.getElementById('pinCard');
  card.classList.remove('open');
  card.style.transform = '';
  document.getElementById('pinCardOverlay').classList.remove('open');
  document.getElementById('app')?.classList.remove('pin-card-open');
  _pinCardOpen = false;
}

// Clicks the pin card's primary action button (whatever it is — "View
// deal details", "View prices", "View details"…) — shared by the
// click-anywhere handler (deals.js: dealPopupCardClick) and the
// swipe-up-to-open drag gesture below. When a card has more than one
// action button (e.g. a combined deal+price popup), the last one wins —
// it's whichever was appended last, which is the primary content for
// that card.
function firePinCardPrimaryAction() {
  const btns = document.querySelectorAll('#pinCardBody .popup-btn');
  if (btns.length) btns[btns.length - 1].click();
}

// Closes the pin card when the user taps empty map background outside it.
// Leaflet only fires 'click' for a genuine tap — if the user was dragging/
// panning past the drag threshold, Leaflet suppresses the click event
// entirely, so this never fires mid-drag. Marker taps don't reach this
// either: Leaflet markers stopPropagation() on their own click, so tapping
// a pin (which opens/refreshes the card) won't immediately close it again.
function bindPinCardOutsideClose(map) {
  if (!map) return;
  map.on('click', () => { if (_pinCardOpen) closePinCard(); });
}

// ── PIN CARD DRAG: whole card, both directions ──
// Only live on cards opened with opts.dragHandle (gated via the
// .show-handle class set in openPinCard) — currently just the
// Discounts/deals map popups, which also hide the ✕ close button, so
// this is their main dismiss/expand affordance. The small handle bar is
// still shown as a visual cue, but the drag itself works from anywhere
// on the card, not just that bar.
//   • Drag down past the threshold → dismiss (closePinCard)
//   • Drag up past the threshold   → open the detail page (same action
//     a tap on the card's own button would trigger)
//   • Anything smaller snaps back — and since we never call
//     preventDefault(), a plain tap on a button still fires its own
//     click normally.
(function() {
  let startY = 0, currentY = 0, dragging = false;
  const getCard = () => document.getElementById('pinCard');

  function onStart(e) {
    const card = getCard();
    if (!card || !card.classList.contains('show-handle')) return; // opt-in only
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = 0;
    card.style.transition = 'none';
  }
  function onMove(e) {
    if (!dragging) return;
    const card = getCard();
    if (!card) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = y - startY;
    // Only actually translate the card while dragging it down — there's
    // no "grow into the detail page" animation to scrub through on drag
    // up, so keep the card visually still until release decides the
    // outcome (open vs snap-back).
    card.style.transform = currentY > 0 ? `translateY(${currentY}px)` : '';
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    const card = getCard();
    if (!card) return;
    card.style.transition = '';
    if (currentY > 80) {
      closePinCard();
    } else if (currentY < -60) {
      card.style.transform = '';
      firePinCardPrimaryAction();
    } else {
      card.style.transform = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    const card = getCard();
    if (!card) return;
    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove',  onMove,  { passive: true });
    card.addEventListener('touchend',   onEnd);
    card.addEventListener('mousedown',  onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onEnd);
  });
})();
