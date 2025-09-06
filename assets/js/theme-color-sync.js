(function(){
  function rgbToHex(rgb) {
    var m = (rgb||"").match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return rgb || "";
    function h(n){ return (parseInt(n,10) & 255).toString(16).padStart(2,'0'); }
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  }
  function ensureThemeColorMeta() {
    var head = document.head || document.getElementsByTagName('head')[0];
    var meta = head.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      head.appendChild(meta);
    }
    return meta;
  }
  function computeThemeColor(){
    var cssVar = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    if (cssVar) return cssVar;
    var bg = getComputedStyle(document.documentElement).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
      bg = getComputedStyle(document.body).backgroundColor;
    }
    return rgbToHex(bg) || bg || '#000000';
  }
  function sync(){
    try {
      var meta = ensureThemeColorMeta();
      meta.setAttribute('content', computeThemeColor());
    } catch(e){}
  }
  // Initial + lifecycle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
  window.addEventListener('pageshow', sync);
  // Observe theme changes via data-theme attribute
  try {
    var obs = new MutationObserver(function(muts){
      for (var i=0; i<muts.length; i++) {
        if (muts[i].type === 'attributes' && muts[i].attributeName === 'data-theme') {
          sync(); break;
        }
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch(e){}
  // Also listen for our custom event if other code dispatches it
  document.addEventListener('theme:changed', sync);
  // Cross-tab broadcast (same as toggle script uses)
  window.addEventListener('storage', function(e){
    if ((e.key||'').indexOf('display-mode') === 0) { sync(); }
  });
})();
