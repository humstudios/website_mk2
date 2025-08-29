(function(){
  'use strict';

  // -------- path helpers --------
  function normalizePath(href){
    try {
      var u = new URL(href, location.href);
      var p = u.pathname;
      // Treat / and /index.html equivalently; trim trailing slash (except root)
      p = p.replace(/index\.html$/i, '');
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      return p.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  // -------- simple DOM helpers --------
  function warn(el, msg){
    var box = document.createElement('div');
    box.style.cssText = 'padding:8px 12px;margin:8px 0;border:1px dashed #f59e0b;color:#92400e;background:#FFFBEB;font:14px/1.4 system-ui;';
    box.textContent = msg;
    el.replaceWith(box);
  }
  function inject(el, html){
    var frag = document.createRange().createContextualFragment(html);
    el.replaceWith(frag);
  }

  // Resolve includes relative to site root (assets/js/ → root)
  function getScriptBase(){
    var s = document.currentScript;
    if (!s) {
      var scripts = document.querySelectorAll('script[src]');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].getAttribute('src') || '';
        if (/assets\/js\/includes\.js(\?|#|$)/.test(src)) { s = scripts[i]; break; }
      }
    }
    var url = new URL(s ? s.src : 'assets/js/includes.js', location.href);
    url.pathname = url.pathname.replace(/[^\/]*$/, ''); // dir of includes.js
    return url;
  }
  var SCRIPT_BASE = getScriptBase();
  var ROOT_BASE = new URL(SCRIPT_BASE);
  ROOT_BASE.pathname = ROOT_BASE.pathname.replace(/assets\/js\/?$/, '');

  // -------- includes loader --------
  async function loadInclude(el){
    var src = el.getAttribute('data-include');
    if (!src) return;
    if (el.__included) return; // prevent dupes
    el.__included = true;

    if (location.protocol === 'file:') {
      warn(el, 'Includes disabled in file:// preview. Run a local server (e.g., “npx http-server”).');
      return;
    }
    var url = new URL(src, ROOT_BASE);
    try {
      var res = await fetch(url.toString(), { credentials: 'same-origin', cache: 'force-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      var html = await res.text();
      inject(el, html);
    } catch (err) {
      console.warn('[includes] Failed to include', url.toString(), err);
      el.remove();
    }
  }

  function ensureCloudsPlaceholder(){
    // opt-out: <body data-no-clouds> or data-clouds="off"
    if (document.body && (document.body.hasAttribute('data-no-clouds') || document.body.getAttribute('data-clouds') === 'off')) {
      return;
    }
    // prevent duplicates
    if (document.querySelector('.clouds, [data-include$="clouds.html"], [data-clouds-include]')) return;

    var src = (document.body && document.body.getAttribute('data-clouds-include')) || 'partials/clouds.html';
    var ph = document.createElement('div');
    ph.setAttribute('data-include', src);
    var skip = document.querySelector('.skip-link');
    if (skip && skip.parentNode) {
      if (skip.nextSibling) skip.parentNode.insertBefore(ph, skip.nextSibling);
      else skip.parentNode.appendChild(ph);
    } else if (document.body) {
      document.body.insertBefore(ph, document.body.firstChild || null);
    }
  }

  function initIncludes(root){
    (root || document).querySelectorAll('[data-include]').forEach(loadInclude);
  }

  // -------- active nav state --------
  function setActiveNav(){
    var pagePath = normalizePath(location.href);
    var nav = document.querySelector('header nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a[href]');

    links.forEach(function(a){
      a.removeAttribute('aria-current');
      a.classList && a.classList.remove('is-active');
    });

    var best = null;
    links.forEach(function(a){
      var linkPath = normalizePath(a.getAttribute('href'));
      if (!linkPath) return;
      // exact match or homepage equivalence
      if (linkPath === pagePath) best = a;
      // Also consider root match for "/" vs ""
      if (!best && pagePath === '' && linkPath === '/') best = a;
    });

    // Fallback: highlight the shortest link that is a prefix of the page path (useful for subpages)
    if (!best){
      var candidates = [];
      links.forEach(function(a){
        var linkPath = normalizePath(a.getAttribute('href'));
        if (linkPath && pagePath.indexOf(linkPath) === 0) candidates.push([linkPath.length, a]);
      });
      if (candidates.length){
        candidates.sort(function(a,b){ return b[0]-a[0]; });
        best = candidates[0][1];
      }
    }

    if (best){
      best.setAttribute('aria-current', 'page');
      if (best.classList) best.classList.add('is-active');
    }
  }

  function run(){
    ensureCloudsPlaceholder();
    var nodes = Array.from(document.querySelectorAll('[data-include]'));
    if (nodes.length === 0){
      setActiveNav();
      return;
    }
    var headerNodes = nodes.filter(function(n){ return /header\.html$/i.test(n.getAttribute('data-include')||''); });
    var footerNodes = nodes.filter(function(n){ return /footer\.html$/i.test(n.getAttribute('data-include')||''); });
    var others = nodes.filter(function(n){ return headerNodes.indexOf(n)===-1 && footerNodes.indexOf(n)===-1; });
    var seq = headerNodes.concat(others, footerNodes);

    seq.reduce(function(p, el){ return p.then(function(){ return loadInclude(el); }); }, Promise.resolve())
       .then(function(){
         document.dispatchEvent(new CustomEvent('partials:loaded'));
         // header is now in DOM → we can safely set the active state
         setActiveNav();
       });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // If your app dynamically adds [data-include] nodes later:
  window.includesInit = function(root){
    initIncludes(root);
    setActiveNav();
  };
})();