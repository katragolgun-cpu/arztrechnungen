// Offline-Unterstützung: App-Dateien und Texterkennung werden zwischengespeichert.
const VERSION = "v26";
const SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME && k !== "share-inbox").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Teilen-Menü: Datei zwischenlegen, dann App öffnen
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData(); const f = fd.get("file");
        if (f && f.size) {
          const c = await caches.open("share-inbox");
          await c.put(new URL("shared-file", self.registration.scope).href,
            new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "Dokument") } }));
        }
      } catch (err) {}
      return Response.redirect(new URL("./?share=1", self.registration.scope).href, 303);
    })());
    return;
  }
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

  // Manifest: immer erst Netz, damit Chrome Änderungen (z. B. Teilen-Menü) sofort sieht
  if (url.origin === location.origin && url.pathname.endsWith("manifest.webmanifest")) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req)));
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
