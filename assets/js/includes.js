(function(){
  'use strict';

  // Resolve includes relative to THIS script's directory, not the page.
  function getScriptBase(){
    // Prefer document.currentScript for accuracy
    var s = document.currentScript;
    if (!s) {
      // Fallback: last script whose src ends with /assets/js/includes.js
      var scripts = document.querySelectorAll('script[src]');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].getAttribute('src') || '';
        if (/assets\/js\/includes\.js(\?|#|$)/.test(src)) { s = scripts[i]; break; }
      }
    }
    var url = new URL(s ? s.src : 'assets/js/includes.js', location.href);
    // directory of the script
    url.pathname = url.pathname.replace(/[^\/]*$/, '');
    return url;
  }

  var SCRIPT_BASE = getScriptBase();
// Compute site root by trimming trailing 'assets/js/' from the script path
var ROOT_BASE = new URL(SCRIPT_BASE);
ROOT_BASE.pathname = ROOT_BASE.pathname.replace(/assets\/js\/?$/, '');


  function warn(el, msg){
    const box = document.createElement('div');
    box.style.cssText = 'padding:8px 12px;margin:8px 0;border:1px dashed #f59e0b;color:#92400e;background:#FFFBEB;font:14px/1.4 system-ui;';
    box.textContent = msg;
    el.replaceWith(box);
  }

  function inject(el, html){
    const frag = document.createRange().createContextualFragment(html);
    el.replaceWith(frag);
  }

  async function load(el){
    let urlAttr = el.getAttribute('data-include');
    if(!urlAttr) return;
    // Resolve against the script directory so nested pages work
    let url;
    try {
      url = new URL(urlAttr, ROOT_BASE);
    } catch (e) {
      url = new URL(urlAttr, location.href);
    }

    if (location.protocol === 'file:') {
      warn(el, 'Includes disabled in file:// preview. Run a local server (e.g., “npx http-server”).');
      return;
    }
    try{
      const res = await fetch(url.toString(), { credentials: 'same-origin', cache: 'force-cache' });
      if(!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      const html = await res.text();
      inject(el, html);
    }catch(err){
      console.error('Include failed for', url.toString(), err);
      warn(el, 'Could not load ' + url.toString() + ' (' + err.message + '). Check the path and that it exists on your server.');
    }
  }

  function run(){
    const nodes = Array.from(document.querySelectorAll('[data-include]'));
    if(nodes.length === 0) return;
    const headerNodes = nodes.filter(n => /header\.html$/i.test(n.getAttribute('data-include')||''));
    const footerNodes = nodes.filter(n => /footer\.html$/i.test(n.getAttribute('data-include')||''));
    const others = nodes.filter(n => headerNodes.indexOf(n)===-1 && footerNodes.indexOf(n)===-1);
    const seq = [...headerNodes, ...others, ...footerNodes];
    seq.reduce((p, el) => p.then(() => load(el)), Promise.resolve())
       .then(() => document.dispatchEvent(new CustomEvent('partials:loaded')));
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  }else{
    run();
  }
})();