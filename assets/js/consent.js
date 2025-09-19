(function () {
  'use strict';
  if (window.__humConsentInit) return;
  window.__humConsentInit = true;

  var PREF_COOKIE = 'hum_consent_prefs'; // 'granted' | 'denied'
  var THEME_COOKIE = 'hum_theme';        // 'light' | 'dark' (optional)

  function setCookie(name, value, maxAgeSeconds) {
    try { document.cookie = name + '=' + encodeURIComponent(value) + '; Max-Age=' + (maxAgeSeconds||0) + '; Path=/; SameSite=Lax; Secure'; } catch(e){}
  }
  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch(e){ return ''; }
  }
  function delCookie(name) { try { document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax; Secure'; } catch(e){} }

  function systemTheme() {
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch(e){ return 'light'; }
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return systemTheme();
  }
  function prefsAllowed() { return getCookie(PREF_COOKIE) === 'granted'; }

  var bannerEl = null;
  function getOrCreateBanner() {
    if (bannerEl && bannerEl.parentNode) return bannerEl;
    // Reuse existing (if any)
    bannerEl = document.querySelector('.consent-banner, .cookie-banner');
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'consent-banner';
      bannerEl.id = 'cookie-banner';
      bannerEl.setAttribute('role', 'dialog');
      bannerEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(bannerEl);
    } else {
      bannerEl.id = 'cookie-banner';
      bannerEl.className = 'consent-banner';
    }
    return bannerEl;
  }

  function clearBannerChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderCard(el) {
    clearBannerChildren(el);

    var card = document.createElement('div');
    card.className = 'consent-banner__card';

    var h = document.createElement('h3');
    h.className = 'consent-banner__title';
    h.textContent = 'Cookie settings';

    var p = document.createElement('p');
    p.className = 'consent-banner__text';
    p.innerHTML = '<strong>Optional:</strong> Let us remember your theme (Light/Dark) across visits.';

    var controls = document.createElement('div');
    controls.className = 'consent-banner__controls';

    var btnDecline = document.createElement('button');
    btnDecline.id = 'cookie-reject';
    btnDecline.type = 'button';
    btnDecline.className = 'consent-btn';
    btnDecline.textContent = 'Decline';

    var btnAllow = document.createElement('button');
    btnAllow.id = 'cookie-accept';
    btnAllow.type = 'button';
    btnAllow.className = 'consent-btn consent-btn--primary';
    btnAllow.textContent = 'Allow';

    controls.appendChild(btnDecline);
    controls.appendChild(btnAllow);

    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(controls);
    el.appendChild(card);

    // Handlers
    btnAllow.addEventListener('click', function(){
      setCookie(PREF_COOKIE, 'granted', 60*60*24*365);
      setCookie(THEME_COOKIE, currentTheme(), 60*60*24*365);
      hide();
      try { document.dispatchEvent(new CustomEvent('consent:change', { detail: { prefs: 'granted' } })); } catch(e){}
    });
    btnDecline.addEventListener('click', function(){
      setCookie(PREF_COOKIE, 'denied', 60*60*24*365);
      delCookie(THEME_COOKIE);
      hide();
      try { document.dispatchEvent(new CustomEvent('consent:change', { detail: { prefs: 'denied' } })); } catch(e){}
    });
  }

  function show(force) {
    if (prefsAllowed() && !force) return;
    var el = getOrCreateBanner();
    renderCard(el);
    el.style.display = 'flex';
    // If multiple banners exist somehow, keep the first
    var banners = document.querySelectorAll('.consent-banner');
    for (var i=1; i<banners.length; i++) {
      banners[i].parentNode && banners[i].parentNode.removeChild(banners[i]);
    }
  }

  function hide() { var el = getOrCreateBanner(); el.style.display = 'none'; }

  // Keep THEME_COOKIE in sync when theme changes
  try {
    window.addEventListener('hum:themechange', function(e){
      var t = e && e.detail && e.detail.theme;
      if (t === 'light' || t === 'dark') {
        if (prefsAllowed()) { setCookie(THEME_COOKIE, t, 60*60*24*365); } else { delCookie(THEME_COOKIE); }
      } else { delCookie(THEME_COOKIE); }
    });
  } catch(e){}

  function init(){ if (!getCookie(PREF_COOKIE)) show(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();

  window.Consent = { show: function(){ show(true); }, hide: hide, allowed: prefsAllowed };
  try { document.dispatchEvent(new Event('consent:ready')); } catch(e) {}
})();