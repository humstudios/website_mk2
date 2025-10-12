(function(){
  'use strict';
  try {
    const m = window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)');
    const saveData = (navigator.connection && navigator.connection.saveData) || (m && m.matches);
    if (saveData) {
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('video[autoplay]').forEach(v => { if (v.hasAttribute('data-allow-autoplay')) return;
          v.pause();
          v.removeAttribute('autoplay');
          v.setAttribute('preload', 'none');
        });
      });
    }
  } catch (_) {}
})();
