// theme-toggle.clean.broadcast.js
// Drop-in replacement for theme-toggle.clean.js that:
// - Saves to sessionStorage (session persistence between pages in same tab)
// - Broadcasts via localStorage key 'display-mode-broadcast' so other tabs update
(function(){
  var root = document.documentElement;
  var btnId = 'theme-toggle';
  var LS = window.localStorage, SS = window.sessionStorage;
  var KEY = 'display-mode';
  var BROADCAST_KEY = 'display-mode-broadcast';

  function getSaved(){
    try { var v = SS.getItem(KEY); if (v==='dark'||v==='light') return v; } catch(e){}
    return (root.getAttribute('data-theme') || 'light');
  }

  function save(v){
    try { SS.setItem(KEY, v); } catch(e){}
    try { LS.setItem(BROADCAST_KEY, v + '|' + Date.now()); } catch(e){}
  }

  function apply(v, btn){
    var m = (v === 'dark') ? 'dark' : 'light';
    root.setAttribute('data-theme', m);
    try { root.style.colorScheme = m; } catch(e){}
    if (btn){
      btn.setAttribute('aria-pressed', m === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = (m === 'dark') ? 'Dark mode' : 'Light mode';
    }
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

  function init(){ wire(document.getElementById(btnId)); }
  document.addEventListener('partials:loaded', init, { once:true });
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else { init(); }

  // Also update if another tab broadcasts a change
  window.addEventListener('storage', function(e){
    if (e.key === BROADCAST_KEY && e.newValue){
      var mode = (e.newValue + '').split('|')[0];
      if (mode==='dark'||mode==='light'){
        try { SS.setItem(KEY, mode); } catch(err){}
        apply(mode, document.getElementById(btnId));
      }
    }
  });
})();
