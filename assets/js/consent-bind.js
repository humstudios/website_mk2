(function(){
  function openBanner(){
    try {
      if (window.Consent && typeof window.Consent.show === 'function') {
        window.Consent.show();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function invokeWithRetry(){
    if (openBanner()) return;
    var start = Date.now();
    (function retry(){
      if (openBanner() || Date.now() - start > 3000) return;
      setTimeout(retry, 100);
    })();
  }

  function onClick(e){
    var target = e.target && (e.target.closest ? e.target.closest('#manage-cookies-btn, [data-action="open-cookies"]') : null);
    if (!target) return;
    e.preventDefault();
    invokeWithRetry();
  }

  // Event delegation covers SPA swaps and late-loaded DOM
  document.addEventListener('click', onClick, true);

  // Also bind directly when possible (MPA + faster response)
  function bindDirect(){
    var el = document.getElementById('manage-cookies-btn');
    if (el && !el.__cookiesBound){
      el.__cookiesBound = true;
      el.addEventListener('click', function(e){ e.preventDefault(); invokeWithRetry(); }, true);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDirect);
  } else {
    bindDirect();
  }
  // Handle Turbo / bfcache / SPA-ish events too
  ['pageshow','turbo:load','turbo:frame-load'].forEach(function(evt){
    addEventListener(evt, bindDirect, { once:false });
  });
})();