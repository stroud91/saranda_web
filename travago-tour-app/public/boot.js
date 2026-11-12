// Runs before the app loads: apply the visitor's saved theme and language to
// <html> so the first paint is already right (no flash of the light theme).
// A separate file, not inline, because the site's Content-Security-Policy
// only allows scripts from the site itself.
(function () {
  try {
    var saved = (JSON.parse(localStorage.getItem("saranda-ui") || "{}").state) || {};
    var root = document.documentElement;
    if (saved.theme === "light" || saved.theme === "dark") root.setAttribute("data-theme", saved.theme);
    if (/^(sq|en|fr|it|de)$/.test(saved.lang)) root.lang = saved.lang;
  } catch (e) {
    /* private mode or blocked storage: the defaults are fine */
  }
})();
