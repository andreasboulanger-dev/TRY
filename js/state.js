// ╔═══════════════════════════════════════════════════════════╗
// ║  STATE — Global App State                                ║
// ╚═══════════════════════════════════════════════════════════╝

let currentPage   = 'home';

// ── MAP INSTANCES ──
let farmMap       = null, dealMap = null, pickerMap = null, pickerMarker = null;

// ── MARKERS & CLUSTERS ──
let farmMarkers   = [], dealMarkers = [], farmCluster = null;

// ── DATA CACHES ──
let allFarms      = [], allDeals = [], allPrices = [];
let _allPricesMaster = []; // unfiltered master copy — allPrices gets mutated by filters
let currentFilteredFarms = [], currentFilteredDeals = [];

// ── VIEW MODES ──
let dealsViewMode = 'map'; // legacy alias — kept in sync with _dealViewMode
let dealsLoaded   = false;
const _dealViewMode  = { value: 'map' };
const _farmsViewMode = { value: 'map' };

// ── PICKER ──
let pickerLat = null, pickerLng = null;

// ── SLIDER ──
let sliderMax = 100;

// ── FILTERS ──
let currentDealsType = 'all';
let currentSubFilter = []; // array — Sub Category carousel is multi-choice (see filters.js)

// ── CURRENT DETAIL IDs ──
// Declared here so strict-mode and ES-module upgrades don't break dependent files.
let currentFarmId = null;

// ── MULTI-SELECT PILL STATE ──
// Declared in state.js (not farms.js) so navigation.js, filters.js, deals.js,
// and farms.js can all reference them safely regardless of script-load order.
const _activeFarmTypes = new Set(['all']);
const _activeDealTypes = new Set(['all']);

