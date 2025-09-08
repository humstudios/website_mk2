(function(){
  'use strict';
  var KEY = 'consent.analytics';
  var bannerId = 'cookie-banner';

  
  // --- Editable text strings (customize safely) ---
  var TEXT = {
    messageHTML: '<strong>Cookies:</strong> We use essential cookies. Turn on analytics to help us improve.',
    acceptLabel: 'Accept analytics',
    rejectLabel: 'Reject non‑essential',
    regionLabel: 'Cookie settings'
  };
function get(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
  function allowed(){ return get() === 'granted'; }
  function set(val){
    try { localStorage.setItem(KEY, val); } catch(e){}
    document.dispatchEvent(new CustomEvent('consent:changed', { detail: { analytics: val }}));
    apply();
  }

  function apply(){
    var ok = allowed();
    // Lazy-load any gated scripts marked for analytics
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent="analytics"][data-src]');
    nodes.forEach(function(node){
      if (node.__loaded || !ok) return;
      var s = document.createElement('script');
      s.src = node.getAttribute('data-src');
      s.async = true;
      // Copy through other data-* attributes (except data-src / data-consent)
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        if (/^data-/.test(a.name) && a.name !== 'data-src' && a.name !== 'data-consent') {
          s.setAttribute(a.name, a.value);
        }
      }
      document.head.appendChild(s);
      node.__loaded = true;
    });
  }

  function getBanner(){ return document.getElementById(bannerId); }
  function dedupeBanners(){
    var list = document.querySelectorAll('.cookie-banner');
    if (list.length > 1) {
      for (var i = 1; i < list.length; i++) {
        try { list[i].remove(); } catch(e){}
      }
    }
  }

  function banner(force){
    var existing = getBanner();
    if (existing) { existing.style.display = 'block'; return; }
    if (get() && !force) { apply(); return; }

    var b = document.createElement('div');
    b.id = bannerId;
    b.className = 'cookie-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', (TEXT.regionLabel || 'Cookie settings'));

    b.innerHTML = '' + '<div class="cookie-banner__inner">' + '  <div class="cookie-banner__actions">' + '    <button id="cookie-reject" class="btn btn-secondary" type="button">' + (TEXT.rejectLabel || 'Reject non‑essential') + '</button>' + '    <button id="cookie-accept" class="btn" type="button">' + (TEXT.acceptLabel || 'Accept analytics') + '</button>' + '  </div>' + '  <p>' + (TEXT.messageHTML || '') + '</p>' + '</div>';

    document.body.appendChild(b);

    var accept = document.getElementById('cookie-accept');
    var reject = document.getElementById('cookie-reject');
    if (accept) accept.addEventListener('click', function(){ set('granted'); b.remove(); });
    if (reject) reject.addEventListener('click', function(){ set('denied'); b.remove(); });

    apply();
  }

  // Public API
  window.Consent = {
    get: get,
    set: set,
    allowed: allowed,
    show: function(){ dedupeBanners(); banner(true); },
    apply: apply
  };

  // Optional integration hooks
  try {
    document.addEventListener('consent:show', function(){ try { window.Consent.show(); } catch(e){} });
  } catch(e){}

  // Initialize on first load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ banner(false); });
  } else {
    banner(false);
  }

  // Signal ready
  try { document.dispatchEvent(new Event('consent:ready')); } catch(e){}
})();