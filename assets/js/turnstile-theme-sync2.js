/* Turnstile theme sync
   - Explicitly renders Cloudflare Turnstile with theme matching <html data-theme>
   - Re-renders when theme changes (toggle, storage, or custom event)
   - Keeps GH Pages paths relative
*/
(function(){
  'use strict';
  var root = document.documentElement;

  function currentTheme() {
    return (root.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
  }

  function getOptionsFrom(el) {
    var opts = {
      sitekey: el.getAttribute('data-sitekey') || '',
      theme: currentTheme()
    };
    var action = el.getAttribute('data-action');
    if (action) opts.action = action;
    var cbName = el.getAttribute('data-callback');
    if (cbName && typeof window[cbName] === 'function') {
      opts.callback = window[cbName];
    }
    return opts;
  }

  function renderAll() {
    var nodes = document.querySelectorAll('.cf-turnstile');
    nodes.forEach(function(el){
      try {
        var id = el.dataset.tsId;
        if (id && window.turnstile && typeof window.turnstile.remove === 'function') {
          try { window.turnstile.remove(id); } catch(e) {}
          el.dataset.tsId = '';
        }
        // Clear any previous iframe content to be safe
        try { el.innerHTML = ''; } catch(e) {}
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          var newId = window.turnstile.render(el, getOptionsFrom(el));
          if (newId) el.dataset.tsId = newId;
        }
      } catch (e) {}
    });
  }

  function whenTurnstileReady(fn) {
    if (window.turnstile && typeof window.turnstile.render === 'function') return fn();
    var tries = 0, max = 200; // up to ~10s
    var iv = setInterval(function(){
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        clearInterval(iv);
        fn();
      } else if (++tries >= max) {
        clearInterval(iv);
      }
    }, 50);
  }

  function init(){
    if (!document.querySelector('.cf-turnstile')) return;
    renderAll();

    // Re-render on theme attribute changes
    try {
      var obs = new MutationObserver(function(muts){
        for (var i=0;i<muts.length;i++){
          if (muts[i].type === 'attributes' && muts[i].attributeName === 'data-theme') {
            renderAll(); break;
          }
        }
      });
      obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    } catch(e){}

    // Cross-tab changes (if your toggle writes to localStorage)
    window.addEventListener('storage', function(ev){
      if (ev && ev.key === 'theme' && (ev.newValue === 'light' || ev.newValue === 'dark')) {
        renderAll();
      }
      // legacy/session scripts that may sync display-mode
      if (ev && ev.key && ev.key.indexOf('display-mode') === 0) {
        renderAll();
      }
    });

    // Custom event hook (dispatchEvent(new Event('theme:changed')))
    document.addEventListener('theme:changed', renderAll);
    window.addEventListener('pageshow', renderAll);
  }

  // Start once Turnstile API is ready (explicit mode)
  whenTurnstileReady(init);
})();
