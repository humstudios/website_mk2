/*! consent-bind.js — Hum Studios (2025-09-12)
 *  Binds page controls to the Consent API provided by consent.js.
 *  - Wires "Change settings" buttons/links
 *  - Auto-opens the banner on cookies.html
 *  - Supports ?consent=open for quick testing
 */
(function(){
  'use strict';

  function openConsent() {
    if (window.Consent && typeof window.Consent.show === 'function') {
      window.Consent.show();
    } else {
      // Defer until consent.js is ready
      document.addEventListener('consent:ready', function(){ 
        try { window.Consent && window.Consent.show && window.Consent.show(); } catch(e){} 
      }, { once: true });
      // As a fallback, fire the event hook consent.js listens for
      try { document.dispatchEvent(new Event('consent:show')); } catch(e){}
    }
  }

  function bind() {
    // Click targets that should open the banner
    var sel = [
      '#manage-cookies-btn',
      '#change-settings',
      '#cookie-settings',
      '[data-action="open-consent"]',
      'a[href="#manage-cookies"]'
    ].join(',');

    document.querySelectorAll(sel).forEach(function(el){
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        openConsent();
      }, { passive: false });
    });

    // Auto-open on the dedicated cookies policy page
    if (document.body && document.body.classList.contains('cookies-page')) {
      // Open after the layout has settled so banner styles apply cleanly
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', openConsent, { once: true });
      } else {
        // Give includes.js a tick to inject header/footer
        requestAnimationFrame(openConsent);
      }
    }

    // Support manual testing via ?consent=open
    if (/\bconsent=open\b/i.test(location.search)) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', openConsent, { once: true });
      } else {
        requestAnimationFrame(openConsent);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})(); 
