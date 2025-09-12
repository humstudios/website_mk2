// early-theme.session.SAFE.js
// Session-only theme with LIGHT default. No observers.
// Include this early in <head>, before your main stylesheet.

(function () {
  try {
    var KEY = "theme.session";
    var saved = null;
    try { saved = sessionStorage.getItem(KEY); } catch (e) {}
    var theme = (saved === "dark" || saved === "light") ? saved : "light";
    var html = document.documentElement;
    if (html.getAttribute("data-theme") !== theme) {
      html.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();