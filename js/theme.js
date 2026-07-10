// ╔═══════════════════════════════════════════════════════════╗
// ║  THEME — Dark/Light Mode, OS Preference, Tile Switching  ║
// ╚═══════════════════════════════════════════════════════════╝

const LIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_TILE_URL  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function isNightTime() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getTileUrl() {
  return isNightTime() ? DARK_TILE_URL : LIGHT_TILE_URL;
}
const TILE_URL = getTileUrl();

// ── THEME STATE ──
let _themeManual = false;

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = dark ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
  const profileThemeIcon = document.getElementById('profileThemeIcon');
  if (profileThemeIcon) profileThemeIcon.className = dark ? 'ti ti-sun' : 'ti ti-moon';
  const profileThemeLabel = document.getElementById('profileThemeLabel');
  if (profileThemeLabel) profileThemeLabel.textContent = dark ? 'White mode' : 'Dark mode';
  // Phase 13: use M3 surface token for light; #1E1E1E (surface-container) for dark chrome
  document.querySelector('meta[name="theme-color"]').content =
    dark ? '#1E1E1E' : getComputedStyle(document.documentElement)
                         .getPropertyValue('--md-sys-color-surface').trim();
  // Swap tile layers on all active maps — _getOrCreateTile lives in map.js (safe at runtime)
  const newUrl = dark ? DARK_TILE_URL : LIGHT_TILE_URL;
  const oldUrl = dark ? LIGHT_TILE_URL : DARK_TILE_URL;
  [window.farmMap, window.dealMap, window.pickerMap, window.communityMap, window.activityPickerMap]
    .filter(m => m && typeof m.addLayer === 'function')
    .forEach(map => {
      const oldLayer = _tileLayers[map._leaflet_id]?.[oldUrl];
      if (oldLayer) map.removeLayer(oldLayer);
      _getOrCreateTile(map, newUrl).addTo(map);
    });
}

function toggleTheme() {
  _themeManual = true;
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
  localStorage.setItem('hive_theme', !isDark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('hive_theme');
  if (saved) {
    _themeManual = true;
    applyTheme(saved === 'dark');
  } else {
    applyTheme(isNightTime());
  }
  // Automatically follow OS dark-mode changes when the user hasn't pinned a theme
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!_themeManual) applyTheme(e.matches);
  });
}

document.addEventListener('DOMContentLoaded', initTheme);
