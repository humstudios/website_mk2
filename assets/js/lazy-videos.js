(function () {
  'use strict';
  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = mq ? mq.matches : false;
  if (reduceMotion && !document.querySelector('video[data-allow-motion]')) return; // allow whitelisted motion

  function lazyLoadVideo(id) {
    var v = document.getElementById(id);
    if (!v) return;
    var loaded = false;
    function load() {
      if (loaded) return;
      var sources = v.querySelectorAll('source[data-src]');
      sources.forEach(function (s) { 'use strict';
  s.src = s.getAttribute('data-src'); s.removeAttribute('data-src'); });
      v.load();
      loaded = true;
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries, observer) {
        'use strict';
  entries.forEach(function (entry) { 'use strict';
  if (entry.isIntersecting) { load(); observer.disconnect(); } });
      }, { rootMargin: '500px' });
      io.observe(v);
    } else {
      if (document.readyState === 'complete' || document.readyState === 'interactive') load();
      else document.addEventListener('DOMContentLoaded', load);
    }
  }
  lazyLoadVideo('howToVideo');
  lazyLoadVideo('adventureVideo');
}());
