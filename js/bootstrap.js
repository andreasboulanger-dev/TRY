// ╔═══════════════════════════════════════════════════════════╗
// ║  BOOTSTRAP — App Initialisation                          ║
// ╚═══════════════════════════════════════════════════════════╝

// ── APP HEIGHT (iOS standalone fix) ──
// html, body, and #app all read this from one shared CSS rule in
// styles.css (`html, body, #app { height: var(--app-vh, 100dvh); }`),
// which falls back to `100dvh` until this runs. iOS home-screen apps have
// a known WebKit quirk where 100dvh can compute a few px short of the
// *real* visible height once installed — leaving a gap at the bottom that
// no safe-area-inset covers, because it isn't a safe-area, it's just a
// measurement bug in that one context. window.visualViewport.height is
// accurate there, so measure it directly and feed it in as --app-vh,
// which that shared rule prefers over 100dvh whenever it's set.
function setAppHeight() {
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty('--app-vh', vh + 'px');
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 100));
if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);

// ── DISABLE ZOOM ──
// The viewport meta tag (user-scalable=no, maximum-scale=1.0) covers most
// browsers, but iOS Safari doesn't always fully honor it — it still allows
// pinch gestures and double-tap-to-zoom. Belt-and-suspenders JS blockers:
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
let _lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
  const now = Date.now();
  if (now - _lastTouchEnd <= 300) e.preventDefault(); // block double-tap zoom
  _lastTouchEnd = now;
}, { passive: false });

// ── LAUNCH / SPLASH ──
const LAUNCH_SLIDE_COUNT = 5;
let _launchSlideIdx = 0;
let _launchTouchStartX = null;

function updateLaunchProgress(idx) {
  document.querySelectorAll('#launchProgress .launch-progress-seg').forEach((seg, i) => {
    seg.classList.toggle('filled', i <= idx);
  });
}

function goToLaunchSlide(idx) {
  idx = Math.max(0, Math.min(LAUNCH_SLIDE_COUNT - 1, idx));
  _launchSlideIdx = idx;
  const track = document.getElementById('launchCarouselTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  updateLaunchProgress(idx);

  const isLast = idx === LAUNCH_SLIDE_COUNT - 1;
  const ctaBtn = document.getElementById('launchCtaBtn');
  const googleBtn = document.getElementById('launchGoogleBtn');
  const twoBtnRow = document.getElementById('launchTwoBtnRow');
  const guestBtn = document.getElementById('launchGuestBtn');
  // Both buttons share the same grid cell (.launch-actions-slot) and stay
  // display:block/flex at all times — toggling this class only flips
  // opacity/visibility, so the swap cross-fades instead of snapping.
  if (ctaBtn) ctaBtn.classList.toggle('launch-slot-hidden', isLast);
  if (googleBtn) googleBtn.classList.toggle('launch-slot-hidden', !isLast);
  if (twoBtnRow) twoBtnRow.classList.toggle('visible', isLast);
  if (guestBtn) guestBtn.classList.toggle('visible', isLast);
}

function continueAsGuest() {
  closeLaunchPage();
}

function launchLogin() {
  openLoginDrawer('login');
}

function launchRegister() {
  openLoginDrawer('register');
}

function launchCtaClick() {
  if (_launchSlideIdx < LAUNCH_SLIDE_COUNT - 1) {
    goToLaunchSlide(_launchSlideIdx + 1);
  } else {
    closeLaunchPage();
  }
}

function bindLaunchCarousel() {
  document.querySelectorAll('#launchProgress .launch-progress-seg').forEach(seg => {
    seg.addEventListener('click', () => goToLaunchSlide(parseInt(seg.dataset.idx, 10)));
  });
  const page = document.getElementById('page-launch');
  if (!page) return;
  page.addEventListener('touchstart', e => { _launchTouchStartX = e.touches[0].clientX; }, { passive: true });
  page.addEventListener('touchend', e => {
    if (_launchTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - _launchTouchStartX;
    if (Math.abs(dx) > 40) goToLaunchSlide(_launchSlideIdx + (dx < 0 ? 1 : -1));
    _launchTouchStartX = null;
  }, { passive: true });
}

async function loadLaunchMemberCount() {
  const el = document.getElementById('launchFooterNote');
  if (!el) return;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/get_member_count`, {
      method: 'POST',
      headers: supaHeaders({ 'Content-Type': 'application/json' }),
      body: '{}'
    });
    const total = await res.json();
    if (total > 0) el.textContent = `Join ${total.toLocaleString()}+ travellers already in the hive 🐝`;
  } catch(e) { /* keep default copy */ }
}

// Re-opens the launch/splash page after it's already been dismissed —
// used as the sign-in entry point from the header "Profile" button
// (see openAuthOrProfile() in auth.js) so signed-out users land on the
// login/register buttons instead of the old standalone auth page.
function openLaunchPage(opts) {
  const el = document.getElementById('page-launch');
  if (!el) return;
  el.classList.remove('closing');
  el.style.display = '';
  const slide = (opts && typeof opts.slide === 'number') ? opts.slide : LAUNCH_SLIDE_COUNT - 1;
  goToLaunchSlide(slide);
}

function closeLaunchPage(afterClose) {
  try { localStorage.setItem('hive_seen_launch', '1'); } catch(e) {}
  const el = document.getElementById('page-launch');
  if (!el) { if (afterClose) afterClose(); return; }
  el.classList.add('closing');
  setTimeout(() => {
    el.style.display = 'none';
    if (afterClose) afterClose();
  }, 450);
}

document.addEventListener('DOMContentLoaded', function() {
  const el = document.getElementById('page-launch');
  if (!el || el.style.display === 'none') return; // already dismissed for returning visitors
  goToLaunchSlide(0);
  bindLaunchCarousel();
  loadLaunchMemberCount();
});

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
