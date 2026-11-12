// Offline-Unterstützung: App-Dateien und Texterkennung werden zwischengespeichert.
const VERSION = "v2";
const SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App-Seite: erst Netz (für Updates), sonst Zwischenspeicher
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // Eigene Dateien und Texterkennung (jsDelivr): erst Zwischenspeicher
  if (url.origin === location.origin || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
