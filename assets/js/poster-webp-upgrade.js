(function () {
  var c = document.createElement('canvas');
  var supportsWebP = !!(c.getContext && c.getContext('2d')) &&
                     c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  if (!supportsWebP) return;
  document.querySelectorAll('video[data-poster-webp]').forEach(function (v) {
    var webp = v.getAttribute('data-poster-webp');
    if (webp) v.poster = webp;
  });
}());
