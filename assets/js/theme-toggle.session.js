// theme-toggle.session.js
// Accessible theme toggle that **does not persist across visits**.
// - Default is 'light' on every new visit.
// - Stores choice in sessionStorage('display-mode') only.
// - Applies html[data-theme="light"|"dark"].
// - Broadcasts via BroadcastChannel for cross-tab sync (no persistence).
(function () {
  var root = document.documentElement;
  var BTN_ID = 'theme-toggle';
  var KEY = 'display-mode'; // 'light' | 'dark'

  // Clear any old localStorage preference on init (we only use session)
  try { localStorage.removeItem(KEY); } catch (e) {}

  var bc = null;
  try { bc = new BroadcastChannel('theme'); } catch (e) {}

  function apply(mode, btn) {
    var m = (mode === 'dark') ? 'dark' : 'light';
    root.setAttribute('data-theme', m);
    if (btn) {
      btn.setAttribute('aria-pressed', String(m === 'dark'));
      btn.title = m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
    try { document.dispatchEvent(new CustomEvent('theme:changed', { detail: { mode: m } })); } catch(e){}
  }

  function save(mode) {
    try { sessionStorage.setItem(KEY, mode); } catch(e) {}
    if (bc) { try { bc.postMessage(mode); } catch(e) {} }
  }

  function current() {
    return (root.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
  }

  function readSaved() {
    try {
      var v = sessionStorage.getItem(KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch(e){}
    return 'light';
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    save(next);
    apply(next, document.getElementById(BTN_ID));
  }

  function init() {
    var btn = document.getElementById(BTN_ID);
    // Reflect any session choice (defaults to light)
    apply(readSaved(), btn);
    if (btn && !btn.__themeBound) {
      btn.addEventListener('click', toggle);
      btn.__themeBound = true;
    }
    if (bc) {
      bc.onmessage = function (ev) {
        var mode = ev && ev.data;
        if (mode === 'dark' || mode === 'light') {
          apply(mode, document.getElementById(BTN_ID));
        }
      };
    }
  }

  // Public API
  window.Theme = {
    init: init,
    toggle: toggle,
    set: function(m){ save(m); apply(m, document.getElementById(BTN_ID)); },
    get: current,
    reset: function(){ try { sessionStorage.removeItem(KEY); } catch(e){} apply('light', document.getElementById(BTN_ID)); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
