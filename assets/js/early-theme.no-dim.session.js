// early-theme.no-dim.session.js
// Session-scoped theme boot. Defaults to 'light' and applies before first paint.
// Listens for cross-tab broadcasts via localStorage 'display-mode-broadcast' key.
// Usage: include BEFORE any CSS, without defer/async.
// Toggle contract (elsewhere in your code):
//   sessionStorage.setItem('display-mode', mode);              // 'light' | 'dark'
//   localStorage.setItem('display-mode-broadcast', mode + '|' + Date.now());
(function(d, w){
  var SS = w.sessionStorage;
  var KEY = 'display-mode';                     // 'light' | 'dark' (session)
  var BROADCAST_KEY = 'display-mode-broadcast'; // 'mode|ts' via localStorage
  var root = d.documentElement;

  function readMode(){
    var v = 'light';
    try {
      var s = SS.getItem(KEY);
      if (s === 'dark' || s === 'light') v = s;
    } catch(e){}
    return v;
  }

  function apply(mode){
    root.setAttribute('data-theme', mode);
    try { root.style.colorScheme = mode; } catch(e){}
  }

  // Pre-paint apply (session-based, defaults to light)
  apply(readMode());

  // Cross-tab sync via localStorage broadcast from your toggle
  try {
    w.addEventListener('storage', function(ev){
      if (!ev || ev.key !== BROADCAST_KEY || !ev.newValue) return;
      var raw = '' + ev.newValue;
      var mode = raw.split('|')[0];
      if (mode !== 'dark' && mode !== 'light') return;
      try { SS.setItem(KEY, mode); } catch(e){}
      apply(mode);
    });
  } catch(e){}
})(document, window);
