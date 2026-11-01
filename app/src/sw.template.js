// Property Estimates offline cache. Generated at build time: the version and file list are filled in by vite.config.ts.
const V = "__VERSION__";
const FONTS = "ghk-fonts";
const SHELL = __SHELL__;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === "navigate") {
      // Try the network for updates, fall back to the saved copy when offline.
      e.respondWith(fetch(r).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html")));
      return;
    }
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(m => m || fetch(r)));
    return;
  }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
