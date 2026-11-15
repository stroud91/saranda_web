// Counts page views for the host's visitor statistics (app/services/stats.py).
// Nothing is stored in the browser and nothing identifies the visitor: the
// request carries the page address, the language in use and, on the first page
// only, the name of the site the visitor arrived from.
import { apiMode } from "./api";
import { currentLang } from "../i18n";

let first = true;
let lastPath = null;

/** True when the browser asks not to be tracked; such visits aren't counted at all. */
export const optedOut = () => typeof navigator !== "undefined" && (navigator.globalPrivacyControl === true || navigator.doNotTrack === "1");

export async function countView(path) {
  if (path === lastPath || optedOut()) return;
  lastPath = path;
  if ((await apiMode()) !== "server") return; // the static copy has nothing to count on
  const body = JSON.stringify({ path, referrer: first ? document.referrer || "" : "", lang: currentLang() });
  first = false;
  try {
    fetch("/api/meta/hit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    // Counting must never get in the way of a page.
  }
}

/** For tests. */
export const resetHits = () => { first = true; lastPath = null; };
