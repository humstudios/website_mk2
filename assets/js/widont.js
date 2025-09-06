// Widon't: keep last two words together without touching inner markup
(function(){
  function widont(selector){
    document.querySelectorAll(selector).forEach(function(el){
      if (el.childElementCount > 0) return; // don’t clobber nested markup
      var t = (el.textContent || '').trim();
      var i = t.lastIndexOf(' ');
      if (i > -1){
        el.textContent = t.slice(0, i) + '\u00A0' + t.slice(i + 1);
      }
    });
  }
  function run(){ widont('h1, h2'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.widont = widont; // optional global if you need to call it elsewhere
}());
