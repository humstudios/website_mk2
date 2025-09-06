// theme-toggle.clean.js
// Lightweight, accessible theme toggle with cross-tab sync.
(function(){
  var root = document.documentElement;
  var BTN_ID = 'theme-toggle';
  var SS = window.sessionStorage, LS = window.localStorage;
  var KEY = 'display-mode';                 // session key for this tab
  var BROADCAST = 'display-mode-broadcast'; // localStorage key to notify other tabs

  function prefersDark(){
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){}
    return false;
  }

  function getSaved(){
    try {
      var v = SS.getItem(KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch(e){}
    // Fallback to current attribute or system preference
    var attr = root.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return prefersDark() ? 'dark' : 'light';
  }

  function save(mode){
    try { SS.setItem(KEY, mode); } catch(e){}
    // Cross-tab broadcast: store + remove to trigger 'storage' event
    try {
      LS.setItem(BROADCAST, mode + '|' + Date.now());
      // Clean up key shortly after to avoid stale values
      setTimeout(function(){ try { LS.removeItem(BROADCAST); } catch(e){} }, 0);
    } catch(e){}
  }

  function labelFor(mode){
    // Title/label describe the *action* the button will perform
    return (mode === 'dark') ? 'Switch to light mode' : 'Switch to dark mode';
  }

  function apply(mode, btn){
    var m = (mode === 'dark') ? 'dark' : 'light';
    // Apply to DOM + hint native controls
    root.setAttribute('data-theme', m);
    try { root.style.colorScheme = m; } catch(e){}
    // Update button a11y + tooltip
    if (btn){
      btn.setAttribute('aria-pressed', m === 'dark' ? 'true' : 'false');
      var action = labelFor(m);
      btn.setAttribute('aria-label', action);
      btn.title = action;
    }
    // Notify any listeners (e.g., theme-color sync)
    try { document.dispatchEvent(new Event('theme:changed')); } catch(e){}
    return m;
  }

  function wire(btn){
    if (!btn) return;
    var cur = getSaved();
    apply(cur, btn);
    btn.addEventListener('click', function(){
      cur = (cur === 'dark') ? 'light' : 'dark';
      save(cur);
      apply(cur, btn);
    });
  }

  function init(){
    var btn = document.getElementById(BTN_ID);
    if (btn) wire(btn);
  }

  // Initial run
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // If header/nav arrives via partials after DOM ready
  document.addEventListener('partials:loaded', init);

  // Cross-tab updates
  window.addEventListener('storage', function(e){
    if (e && e.key === BROADCAST && e.newValue){
      var mode = (e.newValue + '').split('|')[0];
      if (mode === 'dark' || mode === 'light'){
        try { SS.setItem(KEY, mode); } catch(err){}
        apply(mode, document.getElementById(BTN_ID));
      }
    }
  });
})();
