/*! theme-color-sync.js (patched 2025-09-12)
 *  Keeps the browser address-bar color in sync with the chosen theme.
 *  Works with:
 *   - Two media-scoped <meta name="theme-color"> tags (light/dark) for pre-JS correctness
 *   - Optional override <meta name="theme-color"> without media for user-forced themes
 *
 *  Behavior:
 *   - If <html data-theme="light|dark"> is set, an override meta is created/updated to that color.
 *   - If no data-theme (Auto/system), the override meta is removed so the media-scoped tags apply.
 *   - Listens for changes to data-theme and to prefers-color-scheme.
 */
(function () {
  var root = document.documentElement;

  function byMediaContainsDark(m) {
    var media = (m.getAttribute('media') || '').toLowerCase();
    return media.includes('prefers-color-scheme') && media.includes('dark');
  }
  function byMediaContainsLight(m) {
    var media = (m.getAttribute('media') || '').toLowerCase();
    return media.includes('prefers-color-scheme') && media.includes('light');
  }

  function getThemeColorMetas() {
    var metas = Array.prototype.slice.call(document.querySelectorAll('meta[name="theme-color"]'));
    var dark = metas.find(byMediaContainsDark) || null;
    var light = metas.find(byMediaContainsLight) || null;
    var override = metas.find(function (m) { return !m.hasAttribute('media'); }) || null;
    return { light: light, dark: dark, override: override, all: metas };
  }

  function ensureOverrideMeta(afterNode) {
    var m = document.querySelector('meta[name="theme-color"]:not([media])');
    if (m) return m;
    m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    if (afterNode && afterNode.parentNode) {
      afterNode.parentNode.insertBefore(m, afterNode.nextSibling);
    } else {
      document.head.appendChild(m);
    }
    return m;
  }

  function readColors() {
    var metas = getThemeColorMetas();
    var lightColor = metas.light ? metas.light.getAttribute('content') : '#FFFCF5';
    var darkColor  = metas.dark  ? metas.dark.getAttribute('content')  : '#0b1020';
    return { light: lightColor, dark: darkColor };
  }

  function currentPref() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return 'auto';
  }

  function apply() {
    var pref = currentPref();
    var colors = readColors();
    var metas = getThemeColorMetas();

    if (pref === 'light' || pref === 'dark') {
      var color = pref === 'light' ? colors.light : colors.dark;
      var o = ensureOverrideMeta(metas.all[metas.all.length - 1] || null);
      o.setAttribute('content', color);
      // Place override last so it wins if UA picks the last matching tag
      if (o !== document.head.lastElementChild) {
        document.head.appendChild(o);
      }
    } else {
      // Auto/system: remove override so media-scoped tags decide
      if (metas.override && metas.override.parentNode) {
        metas.override.parentNode.removeChild(metas.override);
      }
    }
  }

  // Run now (if head is parsed) or after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  // React to user toggling the theme (data-theme changes)
  var mo = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'data-theme') { apply(); break; }
    }
  });
  mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // Keep in sync with system changes when in Auto
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  if (mql && mql.addEventListener) {
    mql.addEventListener('change', apply);
  } else if (mql && mql.addListener) { // older Safari
    mql.addListener(apply);
  }
})();
