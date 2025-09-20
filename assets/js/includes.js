(function(){
  'use strict';

// --- animation hold to prevent first-paint flash ---
try {
  var __root = document.documentElement;
  if (!__root.hasAttribute('data-anim')) {
    __root.setAttribute('data-anim', 'hold');
  }
} catch (e) {}


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
    // Normalize: if 'src' has no extension, assume .html (e.g., 'partials/clouds' -> 'partials/clouds.html')
    try {
      var _s = src.split('#')[0].split('?')[0];
      var _last = _s.split('/').pop();
      if (_last && !/\.[a-z0-9]+$/i.test(_last)) { src = src + '.html'; }
    } catch (e) {}

    if (el.__included) return; // prevent dupes
    el.__included = true;

    if (location.protocol === 'file:') {
      warn(el, 'Includes disabled in file:// preview. Run a local server (e.g., “npx http-server”).');
      return;
    }
    var url = new URL(src, document.baseURI || location.href);
    if (url.origin !== location.origin || /^(127\.0\.0\.1|localhost)$/i.test(url.hostname)) {
      var base = location.origin + location.pathname.replace(/[^/]*$/, '');
      url = new URL(src, base);
    }
    try {
      // Use the default cache policy for reliability
      var res = await fetch(url.toString(), { credentials: 'same-origin', cache: 'default' });
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
    if (src && !/\.[a-z0-9]+($|\?|\#)/i.test(src)) { src += '.html'; }
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
  // -------- GitHub Pages project-site home link fix --------
  function fixLogoHomeLinkForGithubPages(){
    try {
      if (!/github\.io$/i.test(location.hostname)) return;
      var segs = location.pathname.split('/').filter(Boolean);
      if (!segs.length) return;
      var repo = segs[0];
      document.querySelectorAll('a.logo[href="/"]').forEach(function(a){
        a.setAttribute('href', '/' + repo + '/');
      });
    } catch (e) {}
  }
  // -------- GitHub Pages project-site absolute /assets/ rewriter --------
  function rewriteAbsoluteAssetPathsForGithubPages(){
    try {
      if (!/github\.io$/i.test(location.hostname)) return;
      var segs = location.pathname.split('/').filter(Boolean);
      if (!segs.length) return; // user/org root site
      var repo = segs[0];
      var prefix = '/' + repo + '/assets/';
      var list = document.querySelectorAll('[src^="/assets/"], [href^="/assets/"], [poster^="/assets/"], link[rel="preload"][href^="/assets/"]');
      list.forEach(function(el){
        ['src','href','poster'].forEach(function(attr){
          if (el.hasAttribute && el.hasAttribute(attr)) {
            var v = el.getAttribute(attr);
            if (v && v.indexOf('/assets/') === 0) {
              el.setAttribute(attr, v.replace('/assets/', prefix));
            }
          }
        });
        // Handle srcset (images)
        if (el.hasAttribute && el.hasAttribute('srcset')){
          var ss = el.getAttribute('srcset').split(',').map(function(part){
            var t = part.trim();
            var url = t.split(/\s+/)[0];
            var rest = t.slice(url.length);
            if (url.indexOf('/assets/') === 0) url = url.replace('/assets/', prefix);
            return url + rest;
          }).join(', ');
          el.setAttribute('srcset', ss);
        }
      });
    } catch (e) {}
  }

function __startAnimationsSoon(){
  try {
    requestAnimationFrame(function(){
      document.documentElement.setAttribute('data-anim', 'run');
    });
  } catch (e) {}
}

  function run(){
    ensureCloudsPlaceholder();
    var nodes = Array.from(document.querySelectorAll('[data-include]'));
    
    // If no includes are found, run final setup and exit.
    if (nodes.length === 0){
      rewriteAbsoluteAssetPathsForGithubPages();
      fixLogoHomeLinkForGithubPages();
      setActiveNav();
      __startAnimationsSoon();
      return;
    }
    
    // Process all found includes (e.g., clouds)
    nodes.reduce(function(p, el){ return p.then(function(){ return loadInclude(el); }); }, Promise.resolve())
       .then(function(){
         document.dispatchEvent(new CustomEvent('partials:loaded'));
         // Final setup after includes are loaded
         rewriteAbsoluteAssetPathsForGithubPages();
         fixLogoHomeLinkForGithubPages();
         setActiveNav();
         __startAnimationsSoon();
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