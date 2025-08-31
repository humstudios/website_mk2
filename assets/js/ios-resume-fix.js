/* ios-resume-fix.js
 * v1.0 — Patch for iOS Safari where backgrounded tabs purge images/videos
 * and do not always reload them on resume. Safely rehydrates media on
 * pageshow/visibilitychange and upgrades priority for critical assets.
 * (c) Hum Studios helper
 */
'use strict';

(function () {
  const reloadImg = (img) => {
    if (!img) return;
    const src = img.currentSrc || img.src;
    if (!src) return;
    if (img.complete && img.naturalWidth > 0) return; // already loaded
    img.src = '';
    requestAnimationFrame(() => { img.src = src; });
  };

  const refreshAllImages = () => {
    document.querySelectorAll('img').forEach(reloadImg);
  };

  const refreshVideos = () => {
    document.querySelectorAll('video').forEach((v) => {
      try { v.pause(); } catch (_) {}
      try { v.load(); } catch (_) {}
      if (v.autoplay || v.getAttribute('data-autoplay') === 'true') {
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.play().catch(() => {});
      }
    });
  };

  const onResume = (evt) => {
    const fromCache = evt && 'persisted' in evt ? evt.persisted : false;
    if (document.visibilityState !== 'visible' && !fromCache) return;
    refreshAllImages();
    refreshVideos();
  };

  window.addEventListener('pageshow', onResume, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onResume();
  }, { passive: true });

  // Upgrade priority for critical assets on first load.
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hero img, .clouds img, .logo img').forEach((img) => {
      img.loading = 'eager';
      img.decoding = 'sync';
      img.setAttribute('fetchpriority', 'high');
    });
  });
})();
