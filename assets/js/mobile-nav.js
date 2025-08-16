/* Hum Studios — Mobile Nav (ignore same-click click-away)
   - Waits for header to be injected, binds to hamburger button.
   - Ignores click-away on the same click event as the toggle.
   - Ensures known initial closed state.
*/

(function(){
  if (window.__humMobileNavInitV5) return;
  window.__humMobileNavInitV5 = true;

  var LOG = function(){ try { console.log.apply(console, ['[hum-nav]'].concat([].slice.call(arguments))); } catch(e){} };

  var btn, menu, bound=false, skipClickAway=false;

  function qs(sel){ return document.querySelector(sel); }
  function getBtn(){ return document.getElementById('hamburgerBtn') || qs('.hamburger'); }
  function getMenu(){ return document.getElementById('mobileMenu') || qs('.mobile-nav'); }

  function setClosed(){
    if (menu) {
      menu.hidden = true;
      menu.setAttribute('aria-hidden','true');
      menu.classList.remove('show');
    }
    if (btn) btn.setAttribute('aria-expanded','false');
  }
  function setOpen(){
    if (menu) {
      menu.hidden = false;
      menu.setAttribute('aria-hidden','false');
      menu.classList.add('show');
    }
    if (btn) btn.setAttribute('aria-expanded','true');
  }
  function toggle(){
    if (!btn || !menu) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded || (!expanded && !menu.hidden)) setClosed();
    else setOpen();
  }

  function bind(){
    if (bound) return true;
    btn = getBtn(); menu = getMenu();
    if (!btn || !menu) return false;

    setClosed(); // force closed initial state

    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      skipClickAway = true; // mark that this click is from hamburger
      toggle();
      setTimeout(function(){ skipClickAway = false; }, 0); // reset after this tick
    }, false);

    document.addEventListener('click', function(e){
      if (skipClickAway) return; // ignore the same click as toggle
      if (!menu || menu.hidden) return;
      if (btn === e.target || (btn.contains && btn.contains(e.target))) return;
      if (!menu.contains(e.target)) setClosed();
    }, false);

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && menu && !menu.hidden) setClosed();
    }, false);

    bound = true;
    LOG('bound to button/menu');
    return true;
  }

  if (bind()) return;
  document.addEventListener('DOMContentLoaded', function(){ bind(); }, { once: true });

  var attempts = 0;
  var mo = new MutationObserver(function(muts, obs){
    attempts++;
    if (bind()) {
      LOG('bound via MutationObserver after', attempts, 'mutations');
      obs.disconnect();
    } else if (attempts > 5000) {
      obs.disconnect();
      LOG('gave up waiting for header');
    }
  });
  try { mo.observe(document.documentElement, { childList:true, subtree:true }); } catch(e){}
})();