// Service worker de Paso a paso : toujours la version en ligne quand il y a du réseau,
// la dernière version connue quand il n'y en a pas (« réseau d'abord »).
// Les données (leçons, scores…) sont gérées hors ligne par Firebase lui-même.
const CACHE = "paso-v2";
const HOSTS = [self.location.host, "www.gstatic.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
// Fichiers de l'application mis en mémoire dès l'installation (pour s'ouvrir hors ligne dès la 2e visite)
const SHELL = ["./", "./index.html", "./style.css", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/apple-touch-icon.png",
  "./main.js", "./config.js", "./fb.js", "./core.js", "./ui.js", "./files.js", "./seed.js", "./student.js",
  "./admin.js", "./adm-state.js", "./adm-lessons.js", "./adm-library.js", "./adm-path.js", "./adm-students.js", "./social.js", "./privacy.js", "./adm-social.js"];
self.addEventListener("install", e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(u => cache.add(u).catch(() => {}))); // un fichier manquant ne bloque pas l'installation
  self.skipWaiting();
})()));
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || !HOSTS.includes(url.host)) return; // Firestore, Auth… : jamais interceptés
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req);
      if (hit) return hit;
      // page demandée hors ligne : on sert l'application
      if (req.mode === "navigate") { const home = await cache.match("./") || await cache.match("./index.html"); if (home) return home; }
      // fichier versionné (?v=…) jamais vu : on tente la version sans paramètre déjà en cache
      const base = await cache.match(req, { ignoreSearch: true });
      if (base) return base;
      throw err;
    }
  })());
});
