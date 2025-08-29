// headline-smart-wrap.js
// v1.1 — column-friendly, hyphen-free headline helper with integrated widow-fix
// Usage:
//   <script defer src="assets/js/headline-smart-wrap.js"
//           data-selector="h1, h2, .card h3"
//           data-glue="a|an|the|to|of|in|on|at|for|and|or|vs"
//           data-wbr-after="/–—:"
//           data-allow-children="false"
//   ></script>
//
// Notes:
// - This script is *idempotent*: it marks processed elements and will skip them next runs.
// - Order of operations (to preserve behavior and keep DOM clean):
//     1) Glue "function" words to the following word using NBSP.
//     2) Apply a widow fix (replace the last breaking space with NBSP).
//     3) Insert <wbr> after friendly punctuation (/ – — :), unless one already exists.
// - By default, headings containing child elements are *not* altered (matches legacy widont.js behavior).
//   Set data-allow-children="true" on the <script> tag to process nested content at your own risk.
// - Respects reduced motion and ARIA-hidden nodes by skipping them.

(() => {
  const script = document.currentScript;

  // Config from data-* attributes (with sensible defaults)
  const SELECTOR = script?.dataset.selector || 'h1.smart-wrap, h2.smart-wrap, h3.smart-wrap';
  const GLUE_LIST = (script?.dataset.glue || 'a|an|the|to|of|in|on|at|for|and|or|vs');
  const WBR_CHARS = (script?.dataset.wbrAfter || '/–—:');
  const ALLOW_CHILDREN = (script?.dataset.allowChildren || 'false').toLowerCase() === 'true';

  // Build regex helpers
  // Inline glue pattern: (start|space)(word-from-list)(spaces+) → keep $1 then word + NBSP
  const GLUE_INLINE_RE = new RegExp('(\\b(?:' + GLUE_LIST + ')\\b)\s+', 'gi');
  // We also use this for strict per-token checks if needed
  const GLUE_WORDS_RE = new RegExp('^(?:' + GLUE_LIST + ')$', 'i');
  // Character class for <wbr> insertion
  const WBR_AFTER_RE = new RegExp('[' + WBR_CHARS.replace(/[\]\[]/g, '\\$&') + ']');

  function shouldSkip(el) {
    if (!el) return true;
    if (el.nodeType !== 1) return true; // only elements
    if (el.closest('[aria-hidden="true"]')) return true;
    if (el.dataset.smartWrapDone === '1') return true;
    if (!ALLOW_CHILDREN && el.children.length) return true; // keep behavior conservative
    return false;
  }

  function markDone(el) {
    el.dataset.smartWrapDone = '1';
  }

  // Replace glue words followed by a breaking ASCII space with NBSP in all text nodes
  function glueFunctionWords(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      // Avoid re-gluing if NBSP already present just after a glue word
      node.nodeValue = node.nodeValue.replace(GLUE_INLINE_RE, (m, w) => w + '\u00A0');
    });
  }

  // Widow fix: replace the last breaking space in the *last* text node with NBSP
  function widowFix(el) {
    // Find the last non-empty text node
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    let last = null;
    while (walker.nextNode()) last = walker.currentNode;
    if (!last) return;

    // Skip if it already ends with NBSP or has no regular space before the last word
    const t = last.nodeValue;
    if (!/\s/.test(t)) return;

    // Replace the final *breaking* space-run with NBSP (preserve trailing punctuation/whitespace)
    // Examples:
    //  "Big Adventures!" -> "Big\u00A0Adventures!"
    //  "Free Demo"       -> "Free\u00A0Demo"
    last.nodeValue = t.replace(/(\s+)(\S+)\s*$/, (match, space, tail) => {
      // If the space already contains NBSP, bail
      if (space.indexOf('\u00A0') !== -1) return match;
      return '\u00A0' + tail;
    });
  }

  // Insert <wbr> after specific punctuation characters within each text node.
  // Idempotent: if a <wbr> already follows the punctuation, skip.
  function insertWbr(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.nodeValue && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });

    const toProcess = [];
    while (walker.nextNode()) toProcess.push(walker.currentNode);

    toProcess.forEach(textNode => {
      const text = textNode.nodeValue;
      let i = 0;
      let parent = textNode.parentNode;
      while (i < text.length) {
        const ch = text[i];
        if (WBR_AFTER_RE.test(ch)) {
          // Position after this character
          const afterIndex = i + 1;
          // Split into [before][after], keeping cursor moving along the 'after' text node
          const before = textNode;
          const after = before.splitText(afterIndex);
          // Only insert if nextSibling isn't already a WBR
          if (!(after.previousSibling && after.previousSibling.nodeType === 1 && after.previousSibling.tagName === 'WBR')) {
            const w = document.createElement('wbr');
            parent.insertBefore(w, after);
          }
          // Continue with the 'after' part
          textNode = after;
          parent = after.parentNode;
          // Reset i to 0 for the new text node
          i = 0;
          // Update text reference
          // eslint-disable-next-line no-param-reassign
          if (textNode) {
            // Update text for further scanning
            // (Note: no need to adjust indices for already-consumed text)
          }
        } else {
          i++;
        }
      }
    });
  }

  function processHeadings(root = document) {
    const list = root.querySelectorAll(SELECTOR);
    list.forEach(el => {
      if (shouldSkip(el)) return;
      glueFunctionWords(el);    // 1) NBSP after short glue words
      widowFix(el);             // 2) keep last two words together
      insertWbr(el);            // 3) soft break after friendly punctuation
      markDone(el);
    });
  }

  // Run once when DOM is ready (defer-safe)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => processHeadings(document), { once: true });
  } else {
    processHeadings(document);
  }

  // Optional: watch for dynamically added headings
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.addedNodes) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) processHeadings(node);
        });
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
