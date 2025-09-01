import * as Turbo from "/assets/js/turbo.es2017-esm.js";

// Expose Turbo for debugging in DevTools if needed
window.Turbo = Turbo;

// Normalize paths so '/index.html' and '/' are treated the same
function normalize(path) {
  if (!path) return "/";
  // Strip trailing slash (except root)
  path = path.replace(/\/$/, "") || "/";
  // Treat /index.html as /
  if (path.endsWith("/index.html")) {
    const base = path.slice(0, -"/index.html".length);
    return base || "/";
  }
  return path;
}

// Mark the current page link in both desktop + mobile navs
function setActiveNav() {
  const current = normalize(location.pathname);
  document.querySelectorAll(".top-nav a, .mobile-nav a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    try {
      const linkPath = normalize(new URL(href, location.href).pathname);
      if (linkPath === current) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    } catch (_) {
      a.removeAttribute("aria-current");
    }
  });
}

// Close the mobile menu before navigating so the open state doesn’t “stick”
function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const btn  = document.getElementById("hamburgerBtn");
  if (menu) {
    menu.classList.remove("show");
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
  }
  if (btn) btn.setAttribute("aria-expanded", "false");
}

// Initial paint + subsequent Turbo visits
addEventListener("DOMContentLoaded", setActiveNav);
addEventListener("turbo:load", setActiveNav);
addEventListener("turbo:before-visit", closeMobileMenu);

// --- Turbo integration: prevent smooth scroll + layout animation during visits ---
function setTurboScrollMode(enable) {
  const el = document.documentElement;
  if (enable) el.classList.add("turbo-scroll");
  else el.classList.remove("turbo-scroll");
}
function setTurboSwapping(enable) {
  const b = document.body;
  if (b) {
    if (enable) b.classList.add("turbo-swapping");
    else b.classList.remove("turbo-swapping");
  }
}

// Add/Remove flags at the right lifecycle moments
addEventListener("turbo:before-visit", (e) => {
  // Only disable smooth scrolling if we’re leaving this path or query
  try {
    const next = new URL(e.detail.url, location.href);
    const leavingPath = next.pathname !== location.pathname || next.search !== location.search;
    if (leavingPath) setTurboScrollMode(true);
  } catch (_) {
    setTurboScrollMode(true);
  }
  // Always close the mobile menu
  closeMobileMenu();
});

addEventListener("turbo:before-render", () => setTurboSwapping(true));
addEventListener("turbo:render", () => { setTurboSwapping(false); setTurboScrollMode(false); });
addEventListener("turbo:load", () => { setTurboSwapping(false); setTurboScrollMode(false); });


// Animate container only on the first full load (not on Turbo swaps)
addEventListener("DOMContentLoaded", () => document.body.classList.add("first-load"));
addEventListener("turbo:load", () => document.body.classList.remove("first-load"));

function populateOnce(el) {
  if (!el) return;
  // If already populated, drop the data-include attribute to prevent future fetches
  const tryDrop = () => {
    if (el.childElementCount > 0) {
      el.removeAttribute("data-include");
    }
  };
  // Run now and on next paint (covers includes.js timing)
  tryDrop();
  requestAnimationFrame(tryDrop);
}
addEventListener("DOMContentLoaded", () => populateOnce(document.getElementById("clouds")));
addEventListener("turbo:load", () => populateOnce(document.getElementById("clouds")));

// Keep cloud animation continuous across Turbo visits by using a negative delay
(function(){
  let cloudStart = window.__cloudStart || performance.now();
  window.__cloudStart = cloudStart;

  function syncCloudAnimation() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clouds = document.getElementById("clouds");
    if (!clouds) return;
    const elapsed = (performance.now() - cloudStart) / 1000; // seconds
    clouds.querySelectorAll(".cloud").forEach(el => {
      el.style.animationDelay = `-${elapsed}s`;
      el.style.animationPlayState = "running";
    });
  }

  addEventListener("DOMContentLoaded", syncCloudAnimation);
  addEventListener("turbo:before-render", syncCloudAnimation); // set before adoption/repaint
  addEventListener("turbo:load", syncCloudAnimation);
  addEventListener("visibilitychange", () => { if (!document.hidden) syncCloudAnimation(); });
})();
