// early-theme.session.SAFE.js
// First paint theme with LIGHT default.
// Precedence (sync): sessionStorage -> cookie(hum_theme) -> 'light'
// Also writes the chosen theme back to sessionStorage to survive page navigations.
(function () {
  try {
    var KEY = "theme.session";
    var COOKIE = "hum_theme";

    function getCookie(name){
      try {
        var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : "";
      } catch(e){ return ""; }
    }

    var fromSession = null;
    try {
      var saved = sessionStorage.getItem(KEY);
      fromSession = (saved === "dark" || saved === "light") ? saved : null;
    } catch (e) {}

    var cookieVal = getCookie(COOKIE);
    var fromCookie = (cookieVal === "dark" || cookieVal === "light") ? cookieVal : null;

    var theme = fromSession || fromCookie || "light";

    var html = document.documentElement;
    if (html.getAttribute("data-theme") !== theme) {
      html.setAttribute("data-theme", theme);
    }

    // Ensure sessionStorage reflects the chosen theme for this tab
    try { sessionStorage.setItem(KEY, theme); } catch (e) {}
  } catch (e) {}
})();