(function(){
  var KEY = 'consent.analytics'; // 'granted' | 'denied' | null
  var bannerId = 'cookie-banner';
  var buttons = { accept: 'cookie-accept', reject: 'cookie-reject', manage: 'cookie-manage' };

  function get() {
    try { return localStorage.getItem(KEY); } catch(e) { return null; }
  }
  function set(v) {
    try { localStorage.setItem(KEY, v); } catch(e) {}
    document.dispatchEvent(new CustomEvent('consent:changed', { detail: { analytics: v }}));
    apply(); // gate loaders
  }
  function allowed() { return get() === 'granted'; }

  // Gate any <script type="text/plain" data-consent="analytics" data-src="...">
  function apply() {
    var wantsAnalytics = allowed();
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent="analytics"][data-src]');
    nodes.forEach(function(node){
      if (node.__loaded) return;
      if (wantsAnalytics) {
        var s = document.createElement('script');
        s.src = node.getAttribute('data-src');
        s.async = true;
        document.head.appendChild(s);
        node.__loaded = true;
      }
    });
  }

  // Banner injection (accessible, minimal)
  function injectBanner() {
    if (document.getElementById(bannerId)) return;
    var div = document.createElement('div');
    div.id = bannerId;
    div.className = 'cookie-banner';
    div.setAttribute('role','dialog');
    div.setAttribute('aria-live','polite');
    div.innerHTML =
      '<div class="cookie-banner__inner">' +
        '<p><strong>Cookies:</strong> We use essential cookies. Turn on analytics to help us improve.</p>' +
        '<div class="cookie-banner__actions">' +
          '<button id="'+buttons.reject+'" class="btn btn-secondary">Reject non‑essential</button>' +
          '<button id="'+buttons.accept+'" class="btn">Accept analytics</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div);
    // Wire up
    var accept = document.getElementById(buttons.accept);
    var reject = document.getElementById(buttons.reject);
    if (accept) accept.addEventListener('click', function(){ set('granted'); hideBanner(); });
    if (reject) reject.addEventListener('click', function(){ set('denied'); hideBanner(); });
  }

  function hideBanner(){ var b = document.getElementById(bannerId); if (b) b.remove(); }

  function maybeShowBanner(){
    if (!get()) injectBanner();
    apply(); // in case consent was already granted earlier
  }

  // Public API
  window.Consent = {
    get: get,
    allowed: allowed,
    set: set,
    show: function(){ injectBanner(); },
    apply: apply
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeShowBanner);
  else maybeShowBanner();
})();