/* assets/js/includes.js (unified, prod-safe)
   One file for dev *and* production:
   - Pure RELATIVE URLs only (origin-safe, CSP-safe).
   - Tries with and without ".html" in PARALLEL; first 200 OK wins.
   - Short per-attempt timeout (1500ms) using AbortController.
   - Caches the winning URL in sessionStorage for instant reuse on subsequent loads.
   - Preserves data-include; sets data-include-loaded="true" on success.
*/
(function () {
  if (window.__hum_includes_init__) return; window.__hum_includes_init__ = true;
  "use strict";

  var ATTR = "data-include";
  var ATTR_BASE = "data-include-base";
  var DEFAULT_BASE = "partials/";
  var TIMEOUT_MS = 1500;
  var SS_PREFIX = "inc:url:";

  function getBasePath() {
    var docBase = document.documentElement.getAttribute(ATTR_BASE)
              || (document.body && document.body.getAttribute(ATTR_BASE));
    var base = (docBase || DEFAULT_BASE).trim();
    if (base && !/\/$/.test(base)) base += "/";
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

  function candidates(val, base) {
    var v = (val || "").trim();
    if (!v) return [];
    var name = v.indexOf("/") === -1 ? (base + v) : v;
    name = pathOnly(name);
    var withHtml = name.endsWith(".html") ? name : (name + ".html");
    var withoutHtml = name.endsWith(".html") ? name.slice(0, -5) : name;
    return [withHtml, withoutHtml].filter(function (x, i, a) { return a.indexOf(x) === i; });
  }

  function withTimeout(promise, ms, controller) {
    var t = setTimeout(function () {
  if (window.__hum_includes_init__) return; window.__hum_includes_init__ = true; try { controller.abort(); } catch (e) {} }, ms);
    return promise.finally(function () {
  if (window.__hum_includes_init__) return; window.__hum_includes_init__ = true; clearTimeout(t); });
  }

  function fetchCandidate(url) {
    var ctrl = new AbortController();
    var p = fetch(url, { credentials: "same-origin", cache: "no-store", signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text().then(function (text) { return { ok: true, url: r.url || url, text: text }; });
      })
      .catch(function () {
  if (window.__hum_includes_init__) return; window.__hum_includes_init__ = true; return { ok: false, url: url }; });
    return { promise: withTimeout(p, TIMEOUT_MS, ctrl), abort: function () { try { ctrl.abort(); } catch (e) {} } };
  }

  function raceFirstOk(urls) {
    return new Promise(function (resolve, reject) {
      var pending = [], settled = false, finished = 0;
      urls.forEach(function (u, idx) {
        var c = fetchCandidate(u);
        pending[idx] = c;
        c.promise.then(function (res) {
          finished++;
          if (!settled && res && res.ok) {
            settled = true;
            pending.forEach(function (p, j) { if (j !== idx && p && p.abort) p.abort(); });
            resolve(res);
          } else if (!settled && finished === urls.length) {
            reject(new Error("All candidates failed"));
          }
        }, function () {
          finished++;
          if (!settled && finished === urls.length) reject(new Error("All candidates failed"));
        });
      });
    });
  }

  function cacheKey(val) { return SS_PREFIX + val; }
  function getCached(val) { try { return sessionStorage.getItem(cacheKey(val)); } catch (e) { return null; } }
  function setCached(val, url) { try { sessionStorage.setItem(cacheKey(val), url); } catch (e) {} }

  function loadInto(el, val, base) {
    var cached = getCached(val);
    var urls = cached ? [pathOnly(cached)].concat(candidates(val, base)) : candidates(val, base);
    raceFirstOk(urls).then(function (res) {
      setCached(val, res.url);
      el.innerHTML = res.text;
      el.setAttribute("data-include-loaded", "true");
      el.dispatchEvent(new CustomEvent("include:loaded", { detail: { url: res.url }, bubbles: true }));
    }).catch(function () {
  if (window.__hum_includes_init__) return; window.__hum_includes_init__ = true;
      el.setAttribute("data-include-error", "failed");
    });
  }

  function run() {
    var base = getBasePath();
    document.querySelectorAll("[" + ATTR + "]").forEach(function (el) {
      var val = el.getAttribute(ATTR);
      if (val) loadInto(el, val, base);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
