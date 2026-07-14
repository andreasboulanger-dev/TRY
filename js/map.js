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

  // If HH windows changed (items appear/disappear), do a full re-render —
  // reproducing whatever Main/Sub Category the user currently has selected
  // (currentDealsType / currentSubFilter, kept up to date by both the map's
  // quick pill bar and the advanced-filter drawer — see deals.js /
  // filters.js) so this periodic refresh doesn't quietly revert pin cards
  // back to showing every item in every category again.
  if (hhChanged) {
    renderDealMarkers(
      currentFilteredDeals.length ? currentFilteredDeals : allDeals,
      currentDealsType,
      getCurrentDealsOverridePrices()
    );
    return;
  }

  // Otherwise just update label text + the happy-hour countdown badge
  // in-place for each price pin.
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
    updatePinHHBadge(el, visibleItems);
  });
}

// Soonest happy-hour end time (a Date) across a venue's currently-visible
// priced items, or null if none has one active right now. Thin wrapper
// around getHHEndTime() (deals.js) — used both for the initial pin render
// (renderDealMarkers()) and by updatePinHHBadge() below on each refresh.
function getSoonestHHEnd(items) {
  let soonest = null;
  (items || []).forEach(item => {
    const end = getHHEndTime(item);
    if (end && (!soonest || end < soonest)) soonest = end;
  });
  return soonest;
}

// Keeps a pin's "Happy hour ⚡ <time>" badge (see makePricePin() below)
// live — updates the countdown text, adds the badge the moment a venue's
// soonest HH window becomes active, and removes it once that window ends.
// (A window opening/closing entirely is already handled by the full
// re-render above via getHHStateSnapshot() — this covers everything else,
// i.e. just keeping the displayed time current while it stays active.)
function updatePinHHBadge(pinEl, visibleItems) {
  const wrap = pinEl.querySelector('.map-pin-wrap');
  if (!wrap) return;
  const hhEnd = getSoonestHHEnd(visibleItems);
  const msLeft = hhEnd ? hhEnd - new Date() : -1;
  const showBadge = msLeft > 0;
  let badgeEl = wrap.querySelector('[data-hh-badge]');

  if (!showBadge) {
    if (badgeEl) badgeEl.remove();
    return;
  }

  const timeText = _formatHHDuration(msLeft);
  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.className = 'map-hh-badge';
    badgeEl.setAttribute('data-hh-badge', '');
    badgeEl.innerHTML = `<span class="map-hh-badge-label">Happy hour</span><span class="map-hh-badge-time" data-hh-badge-time>\u26A1 ${timeText}</span>`;
    wrap.appendChild(badgeEl);
    // Same 5s-then-collapse pattern as the initial render in
    // renderDealMarkers() (deals.js) — reads in full for a beat, then
    // shrinks to just the "⚡ <time>" text.
    setTimeout(() => badgeEl.classList.add('collapsed'), 5000);
  } else {
    const timeEl = badgeEl.querySelector('[data-hh-badge-time]');
    if (timeEl) timeEl.textContent = `\u26A1 ${timeText}`;
  }
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
function makePin(emoji, color, disabled) {
  return L.divIcon({ className: '',
    html: `<div class="map-pin${disabled ? ' pin-disabled' : ''}" style="background:${color}"><span class="map-pin-emoji">${emoji}</span></div>`,
    iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-38] });
}

// Small grey dot — used instead of a full pin for a venue that has
// structured opening_hours_json and is closed right now (see the
// "Opening-hours pin gating" comment in renderDealMarkers(), deals.js).
// Still a real, clickable marker with the same popup as always — just
// visually minimized so open venues stand out on the map.
function makeDotPin() {
  return L.divIcon({ className: '',
    html: `<div class="map-pin-dot"></div>`,
    iconSize:[14,14], iconAnchor:[7,7], popupAnchor:[0,-10] });
}

function makePricePin(emoji, color, label, disabled, hhBadge) {
  // hhBadge (optional): { timeText } — passed whenever this venue has an
  // active happy-hour window right now (see getSoonestHHEnd() above /
  // renderDealMarkers() in deals.js). Renders a small "Happy hour ⚡
  // <timeText>" pill above the pin; the "Happy hour" label collapses away
  // after 5s, leaving just "⚡ <timeText>" — see updatePinHHBadge() above
  // for how it's kept ticking afterwards.
  const hhHtml = hhBadge ? `
      <div class="map-hh-badge" data-hh-badge>
        <span class="map-hh-badge-label">Happy hour</span><span class="map-hh-badge-time" data-hh-badge-time>\u26A1 ${hhBadge.timeText}</span>
      </div>` : '';
  // data-price-label lets refreshPricePinLabels() update the text in-place
  return L.divIcon({ className: '',
    html: `<div class="map-pin-wrap">
      <div class="map-pin${disabled ? ' pin-disabled' : ''}" style="background:${color}"><span class="map-pin-emoji">${emoji}</span></div>
      <div class="map-price-label" data-price-label style="background:${color}">${label}</div>
      ${hhHtml}
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
// docked flush with the bottom nav's own bottom edge so it overlays the
// bottom nav and the main FAB (rather than floating above them). It also
// sits above the toggle-fab (list/map button), the bug-fab, and the
// price-slider-bar — its z-index (--z-pincard-panel, see styles.css) is
// the highest of the bunch, so it overlays all of them while open. The
// overlay behind the card has pointer-events:none so panning/dragging the
// map underneath doesn't get intercepted and won't close the card.
let _pinCardOpen = false;

function openPinCard(html, opts) {
  document.getElementById('pinCardBody').innerHTML = html;
  const card = document.getElementById('pinCard');
  const is3Stop = !!(opts && opts.dragHandle);
  card.classList.toggle('hide-close', !!(opts && opts.hideClose));
  // The 3-stop draggable sheet (collapsed/half/full — see getPinCardStops()
  // below) is only live on cards opened with opts.dragHandle, gated via
  // this same .show-handle class — currently just the Discounts/deals map
  // popups. Everything else keeps the old fixed max-height card.
  card.classList.toggle('show-handle', is3Stop);
  // Frosted-glass look on the card itself (blur + translucency), not the
  // full-screen backdrop behind it.
  card.classList.toggle('frosted', !!(opts && opts.blurBackdrop));
  card.style.transform = ''; // clear any leftover drag offset from a previous card
  card.classList.add('open');
  document.getElementById('pinCardOverlay').classList.add('open');
  document.getElementById('app')?.classList.add('pin-card-open');
  document.getElementById('pinCardBody').scrollTop = 0;
  _pinCardOpen = true;

  // Run onOpen before measuring stops, so any layout it triggers (e.g. the
  // happy-hour countdown badge sizing itself in) is settled first and
  // getPinCardStops() below measures the card's real, final content
  // height.
  if (opts && typeof opts.onOpen === 'function') opts.onOpen();

  if (is3Stop) {
    _pinCardStops = getPinCardStops();
    setPinCardStop('half', false); // opens at the same size the old fixed card used to be
  } else {
    card.style.height = ''; // legacy cards size via CSS max-height, not JS
    card.classList.remove('at-full', 'at-collapsed');
    _pinCardStops = null;
  }
}

function closePinCard() {
  const card = document.getElementById('pinCard');
  card.classList.remove('open');
  card.style.transform = '';
  document.getElementById('pinCardOverlay').classList.remove('open');
  document.getElementById('app')?.classList.remove('pin-card-open');
  _pinCardOpen = false;
  _pinCardStop = 'half';
  _pinCardStops = null;
  // Deals popups may have a running happy-hour countdown (deals.js) — stop
  // it so it doesn't keep ticking/updating a detached DOM node.
  if (typeof stopPopupHHTimer === 'function') stopPopupHHTimer();
}

// ── 3-STOP SHEET — snap-point heights ──
// Collapsed (peek, ~name/price row only) / half (matches the old fixed
// card size) / full (near-viewport, leaving clearance for the header).
// collapsed/half are capped at the card's own content height, so a short
// card (e.g. a deal with no price rows) doesn't sit with dead space below
// its content at those smaller stops. full is deliberately NOT
// content-clamped — it always reaches the viewport ceiling, so the sheet
// can be dragged fully open (blank space and all) even on a short card,
// keeping the gesture/reachability consistent across every card.
let _pinCardStops = null;
let _pinCardStop  = 'half';

function getPinCardStops() {
  const card = document.getElementById('pinCard');
  const app  = document.getElementById('app');
  const body = document.getElementById('pinCardBody');
  if (!card || !app) return { collapsed: 150, half: 320, full: 480 };

  const appRect  = app.getBoundingClientRect();
  const bottomPx = parseFloat(getComputedStyle(card).bottom) || 0; // resolves the calc()/env() safe-area offset to a real px value
  const header   = document.querySelector('.app-header');
  const topClear = (header ? header.getBoundingClientRect().bottom - appRect.top : 64) + 12;
  const viewportCap = Math.max(200, appRect.height - bottomPx - topClear);

  const contentH = Math.max(150, (body ? body.scrollHeight : 300) + 32); // +32 = card's own top/bottom padding
  const ceiling  = Math.min(viewportCap, contentH); // used for collapsed/half only — see comment above

  const collapsed = Math.min(150, ceiling);
  const half       = Math.min(Math.max(collapsed, appRect.height * 0.55), ceiling);
  return { collapsed, half, full: viewportCap };
}

// Snaps the sheet to a named stop. animate:false jumps instantly (used on
// open, and on resize) by forcing a synchronous reflow between switching
// the transition off and back on, so the jump never visibly animates.
function setPinCardStop(name, animate) {
  const card = document.getElementById('pinCard');
  if (!card) return;
  if (!_pinCardStops) _pinCardStops = getPinCardStops();
  const px = _pinCardStops[name] != null ? _pinCardStops[name] : _pinCardStops.half;
  _pinCardStop = name;
  if (animate === false) {
    card.style.transition = 'none';
    card.style.height = px + 'px';
    void card.offsetHeight; // force reflow so the 'none' transition actually takes effect
    card.style.transition = '';
  } else {
    card.style.height = px + 'px';
  }
  card.classList.toggle('at-full', name === 'full');
  card.classList.toggle('at-collapsed', name === 'collapsed');
}

// Recompute + re-snap if the viewport changes size while the sheet is open
// (device rotation, browser chrome show/hide, etc).
window.addEventListener('resize', () => {
  const card = document.getElementById('pinCard');
  if (!_pinCardOpen || !card || !card.classList.contains('show-handle')) return;
  _pinCardStops = getPinCardStops();
  setPinCardStop(_pinCardStop, false);
});

// Clicks the pin card's primary action button, if it has one — used by
// the click-anywhere handler (deals.js: dealPopupCardClick). When a card
// has more than one action button, the last one wins — it's whichever
// was appended last, which is the primary content for that card. Most
// deal/price cards no longer have a .popup-btn at all (their info now
// lives directly on the card via the Menu/Deals/Infos tabs), so this is
// a no-op for them.
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

// ── PIN CARD DRAG: 3-stop sheet ──
// Only live on cards opened with opts.dragHandle (gated via the
// .show-handle class set in openPinCard) — currently just the
// Discounts/deals map popups, which also hide the ✕ close button, so this
// drag is their only way to resize or dismiss. The drag works from
// anywhere on the card (not just the handle bar) EXCEPT when it starts
// inside content that's already mid-scroll (pinCardBody.scrollTop > 0) —
// then the touch is left alone so native scrolling wins, same as any
// other bottom sheet. The handle itself always drags, regardless of scroll.
//
//   • Dragging up/down between the collapsed/half/full stops resizes the
//     sheet live, tracking the finger 1:1 (with light rubber-band give
//     past the top "full" stop).
//   • Drag below the "collapsed" stop hands off into dismiss mode — the
//     sheet holds at its collapsed height and the whole card translates
//     down instead, exactly like the old dismiss gesture.
//   • On release: dismiss mode either closes the card (past the
//     threshold) or snaps back to "collapsed"; sheet mode always snaps to
//     whichever of the 3 stops the released height is nearest to.
// We never call preventDefault(), so a plain tap on a button still fires
// its own click normally — BUT a real tap always has a little bit of
// finger jitter, so we don't actually start resizing the sheet until the
// finger has moved past DRAG_THRESHOLD px. Below that, nothing on the
// card is touched at all, so the tap passes straight through to whatever
// button/link/tab is under it (this is what makes the Menu/Deals/Infos
// tabs, and every other button on the card, reliably tappable — before
// this threshold existed, the very first pixel of jitter mid-tap would
// resize the card out from under the finger and the browser would drop
// the click instead of firing it).
(function() {
  const DRAG_THRESHOLD = 8; // px of finger movement before a drag "commits"
  let startY = 0, currentY = 0, tracking = false, committed = false, dragMode = null; // dragMode: 'sheet' | 'dismiss'
  let startHeight = 0;
  const getCard = () => document.getElementById('pinCard');
  const getBody = () => document.getElementById('pinCardBody');

  function onStart(e) {
    const card = getCard();
    if (!card || !card.classList.contains('show-handle')) return; // opt-in only
    const target = e.target;
    const body = getBody();
    const onHandle = target.closest && target.closest('.pin-card-handle');
    if (!onHandle && body && body.contains(target) && body.scrollTop > 0) return; // let content scroll instead
    tracking = true;
    committed = false;
    dragMode = null;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = 0;
  }

  // Only entered once movement crosses DRAG_THRESHOLD — sets up the
  // height/transition state the first time, exactly like onStart used to.
  function commitDrag(card) {
    committed = true;
    dragMode = 'sheet';
    _pinCardStops = getPinCardStops();
    startHeight = parseFloat(getComputedStyle(card).height) || _pinCardStops.half;
    card.style.transition = 'none';
  }

  function onMove(e) {
    if (!tracking) return;
    const card = getCard();
    if (!card) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = y - startY;

    if (!committed) {
      if (Math.abs(currentY) < DRAG_THRESHOLD) return; // still just a tap so far
      commitDrag(card);
      // Re-baseline so the sheet doesn't jump by DRAG_THRESHOLD the instant it commits
      startY = y;
      currentY = 0;
    }

    const stops = _pinCardStops;

    if (dragMode === 'sheet') {
      // Dragging up (currentY < 0) grows the sheet; dragging down shrinks it.
      let newHeight = startHeight - currentY;
      if (newHeight < stops.collapsed) {
        // Below the lowest stop — hand off to dismiss: pin the sheet at
        // its collapsed height and translate the whole card down instead.
        dragMode = 'dismiss';
        card.style.height = stops.collapsed + 'px';
      } else {
        if (newHeight > stops.full) newHeight = stops.full + (newHeight - stops.full) * 0.35; // rubber-band past full
        card.style.height = newHeight + 'px';
        return;
      }
    }
    if (dragMode === 'dismiss') {
      const dismissY = Math.max(0, stops.collapsed - (startHeight - currentY));
      card.style.transform = `translateY(${dismissY}px)`;
    }
  }

  function onEnd() {
    if (!tracking) return;
    tracking = false;
    if (!committed) { dragMode = null; return; } // never left tap territory — nothing to unwind
    const card = getCard();
    if (!card) { committed = false; dragMode = null; return; }
    card.style.transition = '';

    if (dragMode === 'dismiss') {
      const m = /-?\d+(\.\d+)?/.exec(card.style.transform || '');
      const dismissY = m ? parseFloat(m[0]) : 0;
      card.style.transform = '';
      if (dismissY > 70) closePinCard();
      else setPinCardStop('collapsed', true);
      committed = false;
      dragMode = null;
      return;
    }

    // Sheet mode — snap to whichever of the 3 stops is nearest.
    const h = parseFloat(getComputedStyle(card).height) || startHeight;
    const stops = _pinCardStops;
    let nearest = 'collapsed', best = Infinity;
    ['collapsed', 'half', 'full'].forEach(name => {
      const d = Math.abs(h - stops[name]);
      if (d < best) { best = d; nearest = name; }
    });
    setPinCardStop(nearest, true);
    committed = false;
    dragMode = null;
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
