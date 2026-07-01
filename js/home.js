// ╔═══════════════════════════════════════════════════════════╗
// ║  HOME — Stats, Carousels, Community Bar                  ║
// ╚═══════════════════════════════════════════════════════════╝

// ── HOME HELPERS ──

function showLoyaltyComingSoon() {
  showToast('🪪 Member Loyalty Card — coming soon!');
}

function goToDealsWithFilter(type) {
  goTo('deals');
  // Ensure map view is active
  if (dealsViewMode !== 'map') toggleDealsView();
  // Apply the matching pill by data-dtype — wait a tick for initDealMap if first visit
  setTimeout(() => {
    const pill = document.querySelector(`#page-deals .filter-pill[data-dtype="${type}"]`);
    if (pill) filterDeals(pill, type);
  }, 100);
}

function goToCommunityMap() {
  goTo('forum');
  // Ensure map view is shown
  if (communityViewMode !== 'map') toggleCommunityView();
}

// ── HOME STATS ──
async function loadHomeStats() {
  // Simple counts — run in parallel for speed
  const [farmsOk, dealsOk] = await Promise.allSettled([
    supaCount('businesses', 'status=eq.approved'),
    supaCount('deals', 'status=in.(approved,negotiating)'),
  ]);
  if (farmsOk.status === 'fulfilled') {
    document.getElementById('stat-farms').textContent = farmsOk.value;
  } else { logError('loadHomeStats:farms', farmsOk.reason); }
  if (dealsOk.status === 'fulfilled') {
    document.getElementById('stat-deals').textContent = dealsOk.value;
  } else { logError('loadHomeStats:deals', dealsOk.reason); }

  // Member count via SECURITY DEFINER RPC
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/get_member_count`, {
      method: 'POST',
      headers: supaHeaders({ 'Content-Type': 'application/json' }),
      body: '{}'
    });
    const total = await res.json();
    const fmtCount = total >= 1000 ? (total/1000).toFixed(1).replace('.0','')+'k' : total;
    document.getElementById('stat-members').textContent = fmtCount;

    const pct = Math.min(Math.round(total / 2000 * 100), 100);
    document.getElementById('homeCommunityCount')?.textContent && (document.getElementById('homeCommunityCount').textContent = total.toLocaleString() + ' members');
    document.getElementById('communityProgressFill')?.style && (document.getElementById('communityProgressFill').style.width = pct + '%');
    document.getElementById('communityProgressPct')?.textContent && (document.getElementById('communityProgressPct').textContent = pct + '%');
  } catch(e) {
    document.getElementById('stat-members').textContent = '–';
    const el = document.getElementById('homeCommunityCount');
    if (el) el.textContent = '– members';
  }
}

// ── CAROUSELS ──
let _carouselUserPos = null;

// Wire up carousel click delegation once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('bestFarmsCarousel').addEventListener('click', function(e) {
    const card = e.target.closest('.farm-card[data-id]');
    if (!card) return;
    const id  = card.dataset.id;
    const lat = parseFloat(card.dataset.lat) || 0;
    const lng = parseFloat(card.dataset.lng) || 0;
    goTo('farms');
    const delay = farmMap ? 50 : 900;
    setTimeout(function() {
      if (lat && lng) flyTo(farmMap, lat, lng, 13);
      setTimeout(function() { openFarmDetail(id); }, 600);
    }, delay);
  });
  document.getElementById('bestDealsCarousel').addEventListener('click', function(e) {
    const card = e.target.closest('.deal-card-c[data-id]');
    if (!card) return;
    goTo('deals');
    setTimeout(function() { openDealDetail(card.dataset.id); }, 600);
  });
});

async function loadHomeCarousels() {
  try {
    const pos = await getUserLocation();
    if (pos) _carouselUserPos = pos;
  } catch(e) {}
  loadBestFarmsCarousel();
  loadBestDealsCarousel();
}

// ── Best Farms ──
// Ranked by most reviews first (most community-validated), then newest.
// Falls back to nearest if location available and no reviewed farms nearby.
async function loadBestFarmsCarousel() {
  const el = document.getElementById('bestFarmsCarousel');
  if (!el) return;
  try {
    // Step 1: fetch reviewed farms via farm_reviews — count per farm_id
    // We can't do aggregates in PostgREST easily, so fetch recent reviews to
    // build a ranked farm_id list, then fetch those farms.
    const reviews = await supaFetchLimit('farm_reviews', 'order=created_at.desc&limit=200&select=farm_id,rating');

    // Aggregate: count reviews and sum ratings per farm
    const farmStats = {};
    reviews.forEach(r => {
      if (!farmStats[r.farm_id]) farmStats[r.farm_id] = { count: 0, sum: 0 };
      farmStats[r.farm_id].count++;
      farmStats[r.farm_id].sum += (r.rating || 0);
    });

    // Sort farm IDs by count desc (most reviewed = most trusted)
    const rankedIds = Object.keys(farmStats).sort((a, b) => farmStats[b].count - farmStats[a].count).slice(0, 20);

    let farms = [];

    if (rankedIds.length >= 3) {
      // Fetch the top-reviewed farms — filter by location if available
      const idList = rankedIds.join(',');
      farms = await supaFetch('businesses', `status=eq.approved&id=in.(${idList})`);
      // Re-sort by review count
      farms.sort((a, b) => (farmStats[b.id]?.count || 0) - (farmStats[a.id]?.count || 0));
    }

    // Fallback: if few/no reviewed farms, get nearest or most recent
    if (farms.length < 3) {
      let fallbackParams = 'status=eq.approved&order=created_at.desc&limit=12';
      if (_carouselUserPos) {
        const { lat, lng } = _carouselUserPos;
        const pad = 10;
        fallbackParams = `status=eq.approved&latitude=gte.${lat-pad}&latitude=lte.${lat+pad}&longitude=gte.${lng-pad}&longitude=lte.${lng+pad}&order=created_at.desc&limit=12`;
      }
      farms = await supaFetchLimit('businesses', fallbackParams);
    }

    // Final fallback: any farms
    if (!farms.length) {
      farms = await supaFetchLimit('businesses', 'status=eq.approved&order=created_at.desc&limit=12');
    }

    if (!farms.length) {
      el.innerHTML = '<div class="carousel-empty">No farms found yet.</div>';
      return;
    }

    // Merge into allFarms cache so openFarmDetail works
    farms.forEach(f => {
      if (!farmLoadedIds.has(f.id)) { farmLoadedIds.add(f.id); allFarms.push(f); }
    });

    el.innerHTML = farms.slice(0, 10).map(f => {
      const loc      = [f.city, f.state_region].filter(Boolean).join(', ');
      const stats    = farmStats[f.id];
      const ratingTxt = stats && stats.count > 0
        ? parseFloat(stats.sum / stats.count).toFixed(1) + ' / 5 (' + stats.count + ' review' + (stats.count > 1 ? 's' : '') + ')'
        : 'No reviews yet';
      const pay      = f.pay_per_hour_aud ? '$' + f.pay_per_hour_aud + '/hr' : '';
      const cat      = escHTML(f.farm_category_first || 'Farm');
      return `<div class="carousel-card farm-card" data-id="${escHTML(f.id)}" data-lat="${f.latitude||''}" data-lng="${f.longitude||''}">
        <div class="farm-card-body">
          <div class="farm-card-cat-label">${cat}</div>
          <div class="farm-card-name">${escHTML(f.business_name)}</div>
          <div class="farm-card-loc">${escHTML(loc || 'Location TBC')}</div>
          <div class="farm-card-footer">
            <span class="farm-card-stars">${escHTML(ratingTxt)}</span>
            ${pay ? '<span class="farm-card-chip">' + escHTML(pay) + '</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    const el2 = document.getElementById('bestFarmsCarousel');
    if (el2) el2.innerHTML = '<div class="carousel-empty">No farms to show right now.</div>';
    logError('carousel:farms', e);
  }
}

// ── Best Deals ──
// Shows a 50/50 mix of deals and best local prices.
async function loadBestDealsCarousel() {
  const el = document.getElementById('bestDealsCarousel');
  if (!el) return;
  try {
    // Fetch deals
    let deals = [];
    try {
      deals = await supaFetchLimit('deals', 'status=in.(approved,negotiating)&order=created_at.desc&limit=60');
      deals.forEach(d => { if (!allDeals.find(x => x.id === d.id)) allDeals.push(d); });
    } catch(e) {}

    // Fetch local prices
    let prices = [];
    try {
      prices = await supaFetchLimit('local_prices', 'status=eq.approved&select=business_name,city,country,item_category_first,price_normal,item_name&order=price_normal.asc&limit=60');
    } catch(e) {}

    // Sort deals by discount desc
    deals.sort((a, b) => (parseFloat(b.discount||0)) - (parseFloat(a.discount||0)));

    // Group prices by business, keep best (lowest) price per business
    const priceMap = {};
    prices.forEach(p => {
      const key = (p.business_name || '').toLowerCase().trim() + '|' + (p.city||'');
      if (!priceMap[key] || parseFloat(p.price_normal) < parseFloat(priceMap[key].price_normal)) {
        priceMap[key] = p;
      }
    });
    const uniquePrices = Object.values(priceMap);

    // Take up to 5 from each side, interleave deal/price/deal/price...
    const maxEach = 5;
    const dealsSlice  = deals.slice(0, maxEach);
    const pricesSlice = uniquePrices.slice(0, maxEach);
    const mixed = [];
    const maxLen = Math.max(dealsSlice.length, pricesSlice.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < dealsSlice.length)  mixed.push({ _kind: 'deal',  ...dealsSlice[i] });
      if (i < pricesSlice.length) mixed.push({ _kind: 'price', ...pricesSlice[i] });
    }

    if (!mixed.length) {
      el.innerHTML = '<div class="carousel-empty">No deals or prices found yet.</div>';
      return;
    }

    el.innerHTML = mixed.map(item => {
      if (item._kind === 'deal') {
        const d = item;
        const loc  = [d.city, d.country].filter(Boolean).join(', ');
        const disc = parseFloat(d.discount || 0);
        const type = escHTML(d.business_type || 'Business');
        return `<div class="carousel-card deal-card-c" data-id="${escHTML(d.id)}">
          <div class="deal-card-c-body" style="padding-top:12px;">
            <div class="deal-card-c-name">${escHTML(d.business_name)}</div>
            <div class="deal-card-c-type">${escHTML(loc || type)}</div>
            <div class="deal-card-c-footer">
              ${disc > 0 ? '<span class="deal-card-c-disc">-' + disc + '%</span>' : '<span class="deal-card-c-disc" style="font-size:12px;font-family:\'DM Sans\',sans-serif;">Deal</span>'}
              <span class="deal-card-c-status">${type}</span>
            </div>
          </div>
        </div>`;
      } else {
        // price card
        const p = item;
        const loc = [p.city, p.country].filter(Boolean).join(', ');
        const priceStr = p.price_normal ? '$' + parseFloat(p.price_normal).toFixed(2) : '';
        const typeLbl = escHTML(p.item_category_first || 'Local Price');
        return `<div class="carousel-card deal-card-c deal-card-price">
          <div class="deal-card-c-body" style="padding-top:12px;">
            <div class="deal-card-c-name">${escHTML(p.business_name)}</div>
            <div class="deal-card-c-type">${escHTML(loc || typeLbl)}</div>
            <div class="deal-card-c-footer">
              ${priceStr ? '<span class="deal-card-c-disc" style="font-size:13px;color:#185FA5;">' + escHTML(priceStr) + '</span>' : '<span class="deal-card-c-disc" style="font-size:12px;font-family:\'DM Sans\',sans-serif;">Price</span>'}
              <span class="deal-card-c-status" style="background:#E6F1FB;color:#185FA5;">${escHTML(p.item_name || typeLbl)}</span>
            </div>
          </div>
        </div>`;
      }
    }).join('');
  } catch(e) {
    const el2 = document.getElementById('bestDealsCarousel');
    if (el2) el2.innerHTML = '<div class="carousel-empty">No deals to show right now.</div>';
    logError('carousel:deals', e);
  }
}



