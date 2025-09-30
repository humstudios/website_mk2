/* headline-smart-wrap.js
   Safer word-breaking for long headlines.
   - Works only on text nodes (won't break nested markup).
   - Avoids splitText() bounds errors by rebuilding text nodes via a fragment.
   - Inserts <wbr> after natural break points (/, -, ·, •, —, –, _, ., :, ·, camelCase).
*/

(function () {
 'use strict';
   "use strict";

  // Select headings by a data attribute or class (adjust selector if needed)
  var SELECTOR = '[data-smart-wrap], .smart-wrap';

  // Break opportunities: after these characters
  var CHAR_BREAK = /([\/\-\u00B7\u2022\u2014\u2013_\.\:])/g;

  // CamelCase break: lower->upper boundary
  var CAMEL_BREAK = /([a-z])([A-Z])/g;

  function processNodeText(text) {
    // 1) Insert <wbr> after symbolic break chars
    var withChars = text.replace(CHAR_BREAK, function (m, ch) { return ch + "<wbr>"; });
    // 2) Insert <wbr> at camelCase boundaries
    var withCamel = withChars.replace(CAMEL_BREAK, function (m, a, b) { return a + "<wbr>" + b; });
    return withCamel;
  }

  function transformTextNode(tn) {
    if (!tn || !tn.nodeValue || !tn.nodeValue.trim()) return;

    // Build a fragment with interleaved Text nodes and <wbr> elements
    var html = processNodeText(tn.nodeValue);
    if (html.indexOf("<wbr>") === -1) return; // no change

    var frag = document.createDocumentFragment();
    var parts = html.split("<wbr>");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) frag.appendChild(document.createTextNode(parts[i]));
      if (i < parts.length - 1) frag.appendChild(document.createElement("wbr"));
    }
    tn.parentNode.replaceChild(frag, tn);
  }

  function walkAndWrap(root) {
    // Only text nodes; ignore script/style
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.parentNode) return NodeFilter.FILTER_REJECT;
        var tag = node.parentNode.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var n;
    while ((n = tw.nextNode())) nodes.push(n);
    nodes.forEach(transformTextNode);
  }

  function processHeadings() {
    try {
      var nodes = document.querySelectorAll(SELECTOR);
      nodes.forEach(function (el) { 'use strict';
  walkAndWrap(el); });
    } catch (e) {
      // Fail silently to avoid hard errors
      // console.warn('[smart-wrap]', e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processHeadings, { once: true });
  } else {
    processHeadings();
  }
})();
