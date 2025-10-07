// Responsive poster selection with WebP/JPG fallback
(function(){
  function supportsWebP(cb){
    var img = new Image();
    img.onload = function(){ cb(img.width > 0 && img.height > 0); };
    img.onerror = function(){ cb(false); };
    img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBAAAABwAgCdASoBAAEAAwA0JaQAA3AA/v89WQAA";
  }
  function pickPoster(el, webpSupported){
    var mq = window.matchMedia("(max-width: 480px)");
    var mobile = mq.matches;
    var w = mobile ? (webpSupported && el.dataset.posterMobileWebp) || el.dataset.posterMobileJpg
                   : (webpSupported && el.dataset.posterDesktopWebp) || el.dataset.posterDesktopJpg;
    return w || el.getAttribute("poster");
  }
  function applyPosters(webp){
    document.querySelectorAll("video").forEach(function(v){
      if (v.dataset.posterDesktopWebp || v.dataset.posterDesktopJpg || v.dataset.posterMobileWebp || v.dataset.posterMobileJpg){
        var p = pickPoster(v, webp);
        if (p && v.getAttribute("poster") !== p){
          // Set before loading starts to avoid flash
          if (v.readyState === 0) v.setAttribute("poster", p);
          else { // if already loading, swap and force a paint
            v.setAttribute("poster", p);
          }
        }
      }
    });
  }
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ supportsWebP(function(webp){ applyPosters(webp); }); });
  } else {
    supportsWebP(function(webp){ applyPosters(webp); });
  }
})();