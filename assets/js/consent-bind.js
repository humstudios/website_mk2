/*! consent-bind.js — Hum Studios (updated)
 *  Binds page controls to the Consent API provided by consent.js.
 *  - Wires "Change settings" buttons/links
 *  - Auto-opens the banner on cookies.html
 *  - Supports ?consent=open for quick testing
 *  - Banner now offers optional theme cookie only (no analytics cookies)
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
