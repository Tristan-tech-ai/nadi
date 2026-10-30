// Service worker Nadi: halaman luring untuk navigasi saat sinyal hilang. Data tidak di-cache di sini (keamanan data usaha).
const CACHE = "nadi-luring-v1";
const LURING = "/luring";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(LURING, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate" || e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(LURING)));
});
