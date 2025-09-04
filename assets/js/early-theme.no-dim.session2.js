// early-theme.no-dim.session.final.js
// Behavior:
// - Apply theme pre-paint from sessionStorage only (defaults to LIGHT if unset)
// - Optional cross-tab sync: listens for 'display-mode-broadcast' storage events
//   (toggle writes this key with value 'dark|light|timestamp'); we update sessionStorage then apply.
(function(d, w){
  var SS = w.sessionStorage;
  var LS = w.localStorage;
  var KEY = 'display-mode';                  // 'light' | 'dark' (session-scoped)
  var BROADCAST_KEY = 'display-mode-broadcast'; // 'mode|ts'
  var root = d.documentElement;

  function readMode(){
    var v = 'light';
    try {
      var s = SS.getItem(KEY);
      if (s === 'dark' || s === 'light') v = s;
    } catch(e) {}
    return v;
  }

  function apply(mode){
    root.setAttribute('data-theme', mode);
    try { root.style.colorScheme = mode; } catch(e){}
  }

  // 1) Pre-paint apply (session-based, defaults to light)
  apply(readMode());

  // 2) Cross-tab sync (optional): respond to broadcast events
  w.addEventListener('storage', function(ev){
    if (!ev || ev.key !== BROADCAST_KEY || !ev.newValue) return;
    var raw = ev.newValue + '';
    var mode = raw.split('|')[0];
    if (mode !== 'dark' && mode !== 'light') return;
    try { SS.setItem(KEY, mode); } catch(e) {}
    apply(mode);
  });
})(document, window);
