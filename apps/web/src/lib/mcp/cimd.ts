import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

// Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document, MCP 2026-07-28): client_id berupa URL https
// yang menunjuk dokumen JSON metadata klien. Server mengambilnya sendiri, jadi dijaga dari SSRF: hanya https ke alamat publik,
// tanpa redirect, maksimal 5 KB (dibaca bertahap), 5 detik. IP diperiksa di lookup koneksi itu sendiri (Q-14), jadi DNS yang
// berganti jawaban di antara pemeriksaan dan pengambilan (rebinding) tidak lolos (docs Node http.request opsi lookup).

export type KlienCimd = { clientId: string; nama: string; redirectUris: string[] };
type Hasil = { ok: true; klien: KlienCimd } | { ok: false; alasan: string };

// Uji lokal (e2e, `next start` di mesin pengembang) boleh memakai http://localhost lewat env eksplisit; tidak pernah di Vercel.
const izinkanLokal = () => !process.env.VERCEL && process.env.NADI_CIMD_IZINKAN_LOKAL === "1";

/** client_id yang berbentuk URL dianggap CIMD. */
export const adalahCimd = (clientId: string) => /^https?:\/\//i.test(clientId);

/** IPv6 menjadi 8 kelompok 16 bit (termasuk bentuk dengan ekor IPv4). Null bila bentuknya tidak sah. */
function ipv6Kelompok(ip: string): number[] | null {
  let x = ip.toLowerCase().split("%")[0];
  const ekor = x.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ekor) {
    const p = ekor.slice(2).map(Number);
    if (p.some((n) => n > 255)) return null;
    x = `${ekor[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const bagian = x.split("::");
  if (bagian.length > 2) return null;
  const kiri = bagian[0] ? bagian[0].split(":") : [];
  const kanan = bagian.length === 2 ? (bagian[1] ? bagian[1].split(":") : []) : null;
  const isi = kanan === null ? kiri : [...kiri, ...Array(Math.max(0, 8 - kiri.length - kanan.length)).fill("0"), ...kanan];
  if (isi.length !== 8 || isi.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return isi.map((g) => parseInt(g, 16));
}

const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/**
 * Alamat IP yang tidak boleh dihubungi server (loopback, privat, link-local, CGNAT, multicast, dokumentasi), termasuk IPv4 yang
 * dibungkus IPv6: dipetakan (::ffff:), kompatibel (::a.b.c.d), NAT64 (64:ff9b::/96), dan 6to4 (2002::/16).
 */
export function ipTerlarang(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const g = ipv6Kelompok(ip);
  if (!g) return true;
  if (g.slice(0, 5).every((z) => z === 0) && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && g[7] <= 1) return true;
    return ipTerlarang(v4(g[6], g[7]));
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((z) => z === 0)) return ipTerlarang(v4(g[6], g[7]));
  if (g[0] === 0x2002) return ipTerlarang(v4(g[1], g[2]));
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00 || (g[0] === 0x2001 && g[1] === 0x0db8);
}

type CbLookup = (galat: NodeJS.ErrnoException | null, alamat?: string | LookupAddress[], keluarga?: number) => void;

/** Pengganti dns.lookup untuk koneksi keluar: menolak bila salah satu alamat host terlarang. */
export function lookupAman(host: string, opsi: { all?: boolean; family?: number }, cb: CbLookup): void {
  dnsLookup(host, { all: true, family: opsi.family ?? 0 }, (galat, alamat) => {
    if (galat) return cb(galat);
    if (!alamat.length || alamat.some((a) => ipTerlarang(a.address))) {
      return cb(Object.assign(new Error("host menunjuk alamat yang tidak diizinkan"), { code: "EAI_NONAME" }));
    }
    if (opsi.all) cb(null, alamat);
    else cb(null, alamat[0].address, alamat[0].family);
  });
}

const BATAS_BYTE = 5120;

/** GET tanpa redirect; body dibaca bertahap dan koneksi diputus begitu lewat 5 KB; 5 detik; IP diperiksa saat koneksi. */
export function ambilTeksAman(u: URL, opsi: { lokal?: boolean } = {}): Promise<{ status: number; teks: string }> {
  return new Promise((selesai, gagal) => {
    const minta = u.protocol === "https:" ? httpsRequest : httpRequest;
    const req = minta(u, { method: "GET", headers: { Accept: "application/json" }, ...(opsi.lokal ? {} : { lookup: lookupAman as unknown as LookupFunction }) }, (res) => {
      const potongan: Buffer[] = [];
      let n = 0;
      res.on("data", (c: Buffer) => {
        n += c.length;
        if (n > BATAS_BYTE) req.destroy(new Error("dokumen klien lebih dari 5 KB"));
        else potongan.push(c);
      });
      res.on("end", () => selesai({ status: res.statusCode ?? 0, teks: Buffer.concat(potongan).toString("utf8") }));
    });
    const waktu = setTimeout(() => req.destroy(new Error("dokumen klien terlalu lama")), 5000);
    req.on("error", (e) => gagal(e));
    req.on("close", () => clearTimeout(waktu));
    req.end();
  });
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
  if (!lokal && isIP(u.hostname.replace(/^\[|\]$/g, ""))) return { ok: false, alasan: "client_id tidak boleh berupa alamat IP" };
  let r: { status: number; teks: string };
  try {
    r = await ambilTeksAman(u, { lokal });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "";
    if (/lebih dari 5 KB/.test(pesan)) return { ok: false, alasan: "dokumen klien lebih dari 5 KB" };
    if (/tidak diizinkan/.test(pesan)) return { ok: false, alasan: "host client_id menunjuk alamat yang tidak diizinkan" };
    return { ok: false, alasan: "dokumen klien tidak bisa diambil" };
  }
  // Status hulu tidak diteruskan ke pemanggil (tidak membocorkan isi jaringan lain).
  if (r.status !== 200) return { ok: false, alasan: "dokumen klien tidak bisa diambil" };
  try {
    return validasiDokumen(clientId, JSON.parse(r.teks));
  } catch {
    return { ok: false, alasan: "dokumen klien bukan JSON" };
  }
}
