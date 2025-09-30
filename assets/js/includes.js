/* assets/js/includes.js — unified, prod-safe
   - Pure RELATIVE URLs (origin/CSP safe)
   - Tries with and without ".html" in PARALLEL; first 2xx wins
   - Per-attempt timeout (1500ms) via AbortController
   - Caches the winning URL in sessionStorage for reuse
   - Preserves data-include; sets [data-include-loaded] on success
*/
(function () {
  // Dev logger: enable by setting <html data-include-debug="true">
  var __DEBUG__ = (document.documentElement.getAttribute('data-include-debug') === 'true');
  function dbg() { if (!__DEBUG__) return; try { console.log.apply(console, arguments); } catch (e) {} }
  function grp(label) { if (!__DEBUG__) return; try { console.groupCollapsed(label); } catch (e) {} }
  function endgrp() { if (!__DEBUG__) return; try { console.groupEnd(); } catch (e) {} }

  'use strict';
  if (window.__hum_includes_init__) return;
  window.__hum_includes_init__ = true;

  var ATTR = 'data-include';
  var ATTR_BASE = 'data-include-base';
  var DEFAULT_BASE = 'partials/';
  var TIMEOUT_MS = 1500;
  var SS_PREFIX = 'inc:url:';

  function getBasePath() {
    var root = document.documentElement.getAttribute(ATTR_BASE);
    var body = document.body && document.body.getAttribute(ATTR_BASE);
    var base = (root || body || DEFAULT_BASE).trim();
    if (base && !/\/$/.test(base)) base += '/';
    return base;
  }

  function pathOnly(path) {
    try {
      var u = new URL(path, location.href);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return path;
    }
  }

  function unique(arr) {
    var seen = Object.create(null);
    var out = [];
    for (var i=0;i<arr.length;i++) {
      var k = arr[i];
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    }
    return out;
  }

  function candidates(val, base) {
    var v = (val || '').trim();
    if (!v) return [];
    var name = v.indexOf('/') === -1 ? (base + v) : v;
    name = pathOnly(name);
    var withHtml = name.endsWith('.html') ? name : (name + '.html');
    var withoutHtml = name.endsWith('.html') ? name.slice(0, -5) : name;
    return unique([withHtml, withoutHtml]);
  }

  function withTimeout(promise, ms, controller) {
    var t = setTimeout(function () {
  // Dev logger: enable by setting <html data-include-debug="true">
  var __DEBUG__ = (document.documentElement.getAttribute('data-include-debug') === 'true');
  function dbg() { if (!__DEBUG__) return; try { console.log.apply(console, arguments); } catch (e) {} }
  function grp(label) { if (!__DEBUG__) return; try { console.groupCollapsed(label); } catch (e) {} }
  function endgrp() { if (!__DEBUG__) return; try { console.groupEnd(); } catch (e) {} }
 try { controller.abort(); } catch (e) {} }, ms);
    return promise.finally(function () {
  // Dev logger: enable by setting <html data-include-debug="true">
  var __DEBUG__ = (document.documentElement.getAttribute('data-include-debug') === 'true');
  function dbg() { if (!__DEBUG__) return; try { console.log.apply(console, arguments); } catch (e) {} }
  function grp(label) { if (!__DEBUG__) return; try { console.groupCollapsed(label); } catch (e) {} }
  function endgrp() { if (!__DEBUG__) return; try { console.groupEnd(); } catch (e) {} }
 clearTimeout(t); });
  }

  function fetchCandidate(url) {
    var ctrl = new AbortController();
    var req = fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text().then(function (text) { return { ok: true, url: r.url || url, text: text }; });
      })
      .catch(function () {
  // Dev logger: enable by setting <html data-include-debug="true">
  var __DEBUG__ = (document.documentElement.getAttribute('data-include-debug') === 'true');
  function dbg() { if (!__DEBUG__) return; try { console.log.apply(console, arguments); } catch (e) {} }
  function grp(label) { if (!__DEBUG__) return; try { console.groupCollapsed(label); } catch (e) {} }
  function endgrp() { if (!__DEBUG__) return; try { console.groupEnd(); } catch (e) {} }
 return { ok: false, url: url }; });
    return { promise: withTimeout(req, TIMEOUT_MS, ctrl), abort: function () { try { ctrl.abort(); } catch (e) {} } };
  }

  function raceFirstOk(urls) {
    return new Promise(function (resolve, reject) {
      var pending = [], settled = false, finished = 0;
      for (var i=0;i<urls.length;i++) {
        (function (u, idx) {
          var c = fetchCandidate(u);
          pending[idx] = c;
          c.promise.then(function (res) {
            finished++;
            if (!settled && res && res.ok) {
              settled = true;
              for (var j=0;j<pending.length;j++) {
                if (j !== idx && pending[j] && pending[j].abort) pending[j].abort();
              }
              resolve(res);
            } else if (!settled && finished === urls.length) {
              reject(new Error('All candidates failed'));
            }
          }, function () {
            finished++;
            if (!settled && finished === urls.length) reject(new Error('All candidates failed'));
          });
        })(urls[i], i);
      }
    });
  }

  function cacheKey(val) { return SS_PREFIX + val; }
  function getCached(val) { try { return sessionStorage.getItem(cacheKey(val)); } catch (e) { return null; } }
  function setCached(val, url) { try { sessionStorage.setItem(cacheKey(val), url); } catch (e) {} }

  function loadInto(el, val, base) {
  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  grp('include: ' + val);

    var cached = getCached(val);
    var urls = cached ? [pathOnly(cached)].concat(candidates(val, base)) : candidates(val, base);
    dbg('base:', base);
    dbg('cached:', cached || '(none)');
    dbg('candidates:', urls);
    raceFirstOk(urls).then(function (res) {
      setCached(val, res.url);
      var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
      dbg('loaded:', res.url, 'in', Math.round(t1 - t0) + 'ms');
      el.innerHTML = res.text;
      el.setAttribute('data-include-loaded', 'true');
      el.dispatchEvent(new CustomEvent('include:loaded', { detail: { url: res.url }, bubbles: true })); endgrp();
    }).catch(function (err) { dbg('error:', err && err.message ? err.message : err);
  // Dev logger: enable by setting <html data-include-debug="true">
  var __DEBUG__ = (document.documentElement.getAttribute('data-include-debug') === 'true');
  function dbg() { if (!__DEBUG__) return; try { console.log.apply(console, arguments); } catch (e) {} }
  function grp(label) { if (!__DEBUG__) return; try { console.groupCollapsed(label); } catch (e) {} }
  function endgrp() { if (!__DEBUG__) return; try { console.groupEnd(); } catch (e) {} }

      el.setAttribute('data-include-error', 'failed');
      el.dispatchEvent(new CustomEvent('include:error', { bubbles: true })); endgrp();
    });
  }

  function run() {
    var base = getBasePath();
    var nodes = document.querySelectorAll('[' + ATTR + ']');
    for (var i=0;i<nodes.length;i++) {
      var el = nodes[i];
      var val = el.getAttribute(ATTR);
      if (val) loadInto(el, val, base);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
