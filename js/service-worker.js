// ╔═══════════════════════════════════════════════════════════╗
// ║  THE HIVE — Service Worker                               ║
// ║  App-shell precache + stale-while-revalidate for static    ║
// ║  assets. Live data (Supabase, geocoding, map tiles) is     ║
// ║  deliberately left untouched by the cache so farm listings, ║
// ║  deals, and prices are never served stale.                 ║
// ╚═══════════════════════════════════════════════════════════╝

// Bump this on every deploy that changes any precached file —
// it's the only thing that forces old clients to fetch fresh assets.
const CACHE_VERSION = 'v4';
const SHELL_CACHE   = `hive-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `hive-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/utils.js',
  './js/theme.js',
  './js/map.js',
  './js/state.js',
  './js/navigation.js',
  './js/auth.js',
  './js/farms.js',
  './js/deals.js',
  './js/prices.js',
  './js/forum.js',
  './js/submit.js',
  './js/reviews.js',
  './js/community.js',
  './js/filters.js',
  './js/search.js',
  './js/home.js',
  './js/bootstrap.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Hosts whose responses should NEVER be cached — always hit the network.
// (Supabase = live data, Nominatim = live geocoding.)
const NEVER_CACHE_HOSTS = [
  'supabase.co',
  'nominatim.openstreetmap.org',
];

// ── INSTALL — precache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — drop any caches from a previous version ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function isNeverCache(url) {
  return NEVER_CACHE_HOSTS.some(host => url.hostname.endsWith(host));
}

// ── FETCH ──
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/PATCH writes

  const url = new URL(req.url);

  // Live data — always network, never cached, never intercepted.
  if (isNeverCache(url)) return;

  // Navigations (loading the app itself) — network first, falling back to
  // the cached app shell so the app still opens when there's no connection.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else same-origin or known CDN (fonts, leaflet, tabler,
  // our own js/css/icons) — stale-while-revalidate: instant from cache,
  // silently refreshed in the background for next time.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async cache => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
