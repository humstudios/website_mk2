// Scroll restore: keep header in view on hard reloads (F5 / Cmd+R)
(function () {
  try {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
    var isReload = nav ? (nav.type === 'reload')
                       : (performance.navigation && performance.navigation.type === 1);
    if (isReload && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
      // Ensure top after layout/styles settle on normal reloads
      window.addEventListener('load', function () { window.scrollTo(0, 0); }, { once: true });
      // Also handle bfcache restores just in case
      window.addEventListener('pageshow', function (e) { if (e.persisted) window.scrollTo(0, 0); }, { once: true });
    }
  } catch (e) { /* no-op */ }
}());

(function () {
  var btn = document.getElementById('hamburgerBtn');
  var menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  var mq = window.matchMedia('(min-width: 768px)');
  var lastFocus = null;

  function focusables(container) {
    return container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }

  function isOpen() { return menu.classList.contains('show'); }

  function setOpen(open) {
    if (open === isOpen()) return;
    if (open) {
      menu.classList.add('show');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      if (document.activeElement === btn) lastFocus = btn;
      var f = focusables(menu);
      if (f.length) f[0].focus();
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('click', onDocClick, true);
    } else {
      menu.classList.remove('show');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('click', onDocClick, true);
      if (lastFocus) btn.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'Tab' && isOpen()) {
      var f = Array.from(focusables(menu));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target === btn) {
      e.preventDefault();
      setOpen(!isOpen());
    }
  }

  function onDocClick(e) {
    if (!menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  }

  btn.addEventListener('click', function(){ setOpen(!isOpen()); });

  // Close when switching to desktop breakpoint
  function onBreakpointChange(e) { if (e.matches) setOpen(false); }
  if (mq.addEventListener) mq.addEventListener('change', onBreakpointChange);
  else mq.addListener(onBreakpointChange); // older Safari

  // Init state
  btn.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
  setOpen(false);
}());

// Mark init complete for safety-net detection
window.__humMenuInit = true;
