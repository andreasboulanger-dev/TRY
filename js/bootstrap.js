// ╔═══════════════════════════════════════════════════════════╗
// ║  BOOTSTRAP — App Initialisation                          ║
// ╚═══════════════════════════════════════════════════════════╝

// ── INIT ──
// Wrapped in DOMContentLoaded so DOM elements (e.g. #headerAuthBtn) exist
// before any of these functions try to query them.
document.addEventListener('DOMContentLoaded', function() {
  handleOAuthRedirect();
  updateHeaderAuth();
  loadHomeStats();
  loadHomeCarousels();

  // Phase 13: Ensure theme-color meta is correct on init (belt-and-suspenders after applyTheme)
  const isDark = document.documentElement.classList.contains('dark');
  document.querySelector('meta[name="theme-color"]').content =
    isDark ? '#1E1E1E' : getComputedStyle(document.documentElement)
                           .getPropertyValue('--md-sys-color-surface').trim();
});

document.addEventListener('DOMContentLoaded', function() {
  const logo = document.getElementById('animLogo');
  if (!logo) return;
  const letters = logo.querySelectorAll('.logo-letter');
  const H = logo.querySelector('.logo-H');
  let isCollapsed = false;
  let basePositions = null;

  const locSuffix = document.createElement('span');
  locSuffix.id = 'logoLocSuffix';
  locSuffix.style.cssText = 'position:absolute;font-family:"Fraunces",serif;font-size:22px;font-weight:700;color:var(--text-light);opacity:0;transition:opacity 0.35s ease;pointer-events:none;white-space:nowrap;top:0;left:0;';
  logo.style.position = 'relative';
  logo.appendChild(locSuffix);

  let cityName = null;
  function fetchCity() {
    if (cityName !== null) return;
    cityName = '';
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&format=json', { headers: { 'User-Agent': 'TheHiveApp/1.0' } })
        .then(r => r.json())
        .then(d => {
          const addr = d.address || {};
          cityName = addr.city || addr.town || addr.village || addr.county || '';
          if (isCollapsed) showSuffix();
        }).catch(() => {});
    }, () => {});
  }

  function showSuffix() {
    const hRect = H.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    locSuffix.style.left = (hRect.right - logoRect.left) + 'px';
    locSuffix.style.top = (hRect.top - logoRect.top) + 'px';
    locSuffix.textContent = '.' + (cityName || 'earth');
    locSuffix.style.opacity = '1';
  }

  function measure() {
    basePositions = [];
    const logoRect = logo.getBoundingClientRect();
    letters.forEach(l => {
      const r = l.getBoundingClientRect();
      basePositions.push(r.left - logoRect.left + r.width / 2);
    });
  }

  function collapse() {
    if (!basePositions) measure();
    const hIdx = Array.from(letters).indexOf(H);
    const hPos = basePositions[hIdx];
    const hWidth = H.getBoundingClientRect().width;
    const targetX = -(hPos - hWidth / 2);
    letters.forEach((l, i) => {
      if (i === hIdx) {
        l.style.transform = 'translateX(' + targetX + 'px)';
      } else {
        l.style.transform = 'translateX(' + (hPos - basePositions[i] + targetX) + 'px)';
        l.classList.add('collapsed');
      }
    });
    isCollapsed = true;
    fetchCity();
    setTimeout(() => { if (isCollapsed) showSuffix(); }, 420);
  }

  function expand() {
    locSuffix.style.opacity = '0';
    letters.forEach(l => {
      l.style.transform = 'translateX(0px)';
      l.classList.remove('collapsed');
    });
    isCollapsed = false;
  }

  const homePage = document.getElementById('page-home');
  if (homePage) {
    let ticking = false;
    homePage.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const sy = homePage.scrollTop;
          if (sy > 30 && !isCollapsed) collapse();
          else if (sy <= 30 && isCollapsed) expand();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  setTimeout(() => {
    const orig = window.goTo;
    if (typeof orig === 'function') {
      window.goTo = function(page) {
        orig.apply(this, arguments);
        if (page === 'home') {
          setTimeout(() => { measure(); if (homePage && homePage.scrollTop > 30) { if (!isCollapsed) collapse(); } else { if (isCollapsed) expand(); } }, 50);
        } else {
          if (isCollapsed) expand();
        }
      };
    }
  }, 0);

  document.fonts.ready.then(() => { measure(); });
});
