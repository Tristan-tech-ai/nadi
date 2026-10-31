// Alat bantu Web Push yang tidak bergantung pada browser, supaya bisa diuji.

/** Kunci publik VAPID (base64url) menjadi byte untuk pushManager.subscribe. */
export function bytesDariBase64Url(teks: string): Uint8Array<ArrayBuffer> {
  const isi = teks.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (teks.length % 4)) % 4);
  const biner = atob(isi);
  const hasil = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

export type LanggananPush = { endpoint: string; p256dh: string; auth: string };

// Host layanan push peramban yang dikenal (Q-14, cegah SSRF lewat endpoint buatan). Sumber: docs Microsoft WNS (domain
// notify.windows.com, resmi); FCM, Mozilla autopush, Apple dari sumber sekunder (loop/LEARN.md 31 Okt 2026).
const HOST_PUSH = ["fcm.googleapis.com", "updates.push.services.mozilla.com"];
const AKHIRAN_PUSH = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

/** Endpoint https ke layanan push yang dikenal (host persis atau subdomain dari akhiran yang dikenal). */
export function hostPushDikenal(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  return u.protocol === "https:" && !u.port && (HOST_PUSH.includes(host) || AKHIRAN_PUSH.some((a) => host.endsWith(a)));
}

/** Memeriksa bentuk PushSubscription.toJSON() dari klien sebelum disimpan. Null bila tidak sah. */
export function bacaLangganan(masukan: unknown): LanggananPush | null {
  if (!masukan || typeof masukan !== "object") return null;
  const { endpoint, keys } = masukan as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 2048 || !hostPushDikenal(endpoint)) return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  const b64url = /^[A-Za-z0-9_-]+={0,2}$/;
  if (typeof p256dh !== "string" || !b64url.test(p256dh) || p256dh.length > 128) return null;
  if (typeof auth !== "string" || !b64url.test(auth) || auth.length > 64) return null;
  return { endpoint, p256dh, auth };
}

/** Nama perangkat singkat dari user agent, agar pemilik tahu perangkat mana yang berlangganan. */
export function namaPerangkat(ua: string): string {
  const sistem = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Perangkat";
  const peramban = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return peramban ? `${sistem}, ${peramban}` : sistem;
}
