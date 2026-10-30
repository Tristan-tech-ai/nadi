import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document, MCP 2026-07-28): client_id berupa URL https
// yang menunjuk dokumen JSON metadata klien. Server mengambilnya sendiri, jadi dijaga dari SSRF: hanya https ke alamat publik,
// tanpa redirect, maksimal 5 KB, 5 detik.

export type KlienCimd = { clientId: string; nama: string; redirectUris: string[] };
type Hasil = { ok: true; klien: KlienCimd } | { ok: false; alasan: string };

// Uji lokal (e2e, `next start` di mesin pengembang) boleh memakai http://localhost lewat env eksplisit; tidak pernah di Vercel.
const izinkanLokal = () => !process.env.VERCEL && process.env.NADI_CIMD_IZINKAN_LOKAL === "1";

/** client_id yang berbentuk URL dianggap CIMD. */
export const adalahCimd = (clientId: string) => /^https?:\/\//i.test(clientId);

/** Alamat IP yang tidak boleh dihubungi server (loopback, privat, link-local, CGNAT, multicast, dokumentasi). */
export function ipTerlarang(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return ipTerlarang(x.slice(7));
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
}

/** Bentuk URL client_id: https, ada path selain "/", tanpa fragmen dan kredensial. */
export function urlClientIdSah(clientId: string, lokal = izinkanLokal()): URL | null {
  let u: URL;
  try {
    u = new URL(clientId);
  } catch {
    return null;
  }
  const lokalBoleh = lokal && u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !lokalBoleh) return null;
  if (u.pathname === "/" || u.hash || u.username || u.password || clientId.length > 300) return null;
  return u;
}

/** Validasi isi dokumen (tanpa jaringan). */
export function validasiDokumen(clientId: string, doc: unknown): Hasil {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, alasan: "dokumen bukan objek JSON" };
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId) return { ok: false, alasan: "client_id di dokumen tidak sama dengan URL-nya" };
  if (typeof d.client_name !== "string" || !d.client_name.trim()) return { ok: false, alasan: "client_name wajib" };
  const uris = d.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 10 || !uris.every((u) => typeof u === "string")) return { ok: false, alasan: "redirect_uris wajib berisi 1 sampai 10 URL" };
  if (d.token_endpoint_auth_method !== undefined && d.token_endpoint_auth_method !== "none") return { ok: false, alasan: "Nadi hanya menerima klien publik (token_endpoint_auth_method none)" };
  return { ok: true, klien: { clientId, nama: d.client_name.trim().slice(0, 80), redirectUris: uris as string[] } };
}

/** Ambil dan validasi dokumen CIMD. */
export async function ambilCimd(clientId: string): Promise<Hasil> {
  const u = urlClientIdSah(clientId);
  if (!u) return { ok: false, alasan: "client_id harus URL https dengan path" };
  const lokal = izinkanLokal() && u.protocol === "http:";
  if (!lokal) {
    if (isIP(u.hostname.replace(/^\[|\]$/g, ""))) return { ok: false, alasan: "client_id tidak boleh berupa alamat IP" };
    try {
      const alamat = await lookup(u.hostname, { all: true });
      if (!alamat.length || alamat.some((a) => ipTerlarang(a.address))) return { ok: false, alasan: "host client_id menunjuk alamat yang tidak diizinkan" };
    } catch {
      return { ok: false, alasan: "host client_id tidak ditemukan" };
    }
  }
  try {
    const r = await fetch(u, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    if (r.status !== 200) return { ok: false, alasan: `dokumen klien tidak bisa diambil (HTTP ${r.status})` };
    const teks = await r.text();
    if (teks.length > 5120) return { ok: false, alasan: "dokumen klien lebih dari 5 KB" };
    return validasiDokumen(clientId, JSON.parse(teks));
  } catch {
    return { ok: false, alasan: "dokumen klien tidak bisa diambil atau bukan JSON" };
  }
}
