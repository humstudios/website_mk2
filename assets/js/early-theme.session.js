// early-theme.session.js
// Apply theme BEFORE first paint. Default is 'light' on every new visit.
// Uses sessionStorage only; clears any old localStorage preference.
(function (d, w) {
  var root = d.documentElement;
  var KEY = 'display-mode';
  var mode = 'light'; // default every visit

  // Forget any persisted preference from older versions
  try { w.localStorage.removeItem(KEY); } catch (e) {}

  // Respect session choice (dark) within the same tab/session
  try {
    var saved = w.sessionStorage.getItem(KEY);
    if (saved === 'dark') mode = 'dark';
  } catch (e) {}

  // Apply immediately to avoid flash
  root.setAttribute('data-theme', mode);

  // Ensure sessionStorage reflects what we applied
  try { w.sessionStorage.setItem(KEY, mode); } catch (e) {}
})(document, window);
