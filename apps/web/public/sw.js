// Service worker Nadi: halaman luring untuk navigasi saat sinyal hilang. Data tidak di-cache di sini (keamanan data usaha).
const CACHE = "nadi-luring-v2";
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

// Web Push: isi dari Edge Function `push` berbentuk { judul, isi, tautan }.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { isi: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(data.judul || "Nadi", {
      body: data.isi || "",
      icon: "/ikon/ikon-192.png",
      badge: "/ikon/ikon-192.png",
      lang: "id",
      data: { tautan: data.tautan || "/app" },
    }),
  );
});

// Ketuk pemberitahuan: pakai jendela Nadi yang sudah terbuka bila ada, kalau tidak buka baru.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const tujuan = new URL((e.notification.data && e.notification.data.tautan) || "/app", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((daftar) => {
      for (const c of daftar) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(tujuan);
          return c.focus();
        }
      }
      return self.clients.openWindow(tujuan);
    }),
  );
});
