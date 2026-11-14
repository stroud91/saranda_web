/* Saranda Companion service worker: app-shell offline support.
   - Hashed build assets: cache-first (immutable).
   - Navigations: network-first, falling back to the cached shell.
   - API calls are never cached here (they carry live data and references). */
const VERSION = "sc-v5";
const SHELL = ["/", "/boot.js", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Uploaded photos and videos under /media/ go straight to the network: opening one in
  // its own tab is a "navigation", and it must never be stored as the offline page.
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put("/", copy));
        return res;
      }).catch(() => caches.match("/"))
    );
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
