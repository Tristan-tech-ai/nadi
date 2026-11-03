import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adalahCimd, ambilCimd } from "@/lib/mcp/cimd";
import { CAKUPAN, asal, resourceMcp } from "@/lib/mcp/http";

export type Permintaan = {
  clientId: string;
  namaKlien: string;
  hostKlien: string;
  redirectUri: string;
  state: string;
  challenge: string;
  cakupan: string[];
  resource: string;
  iss: string;
};
type Q = Record<string, string | string[] | undefined>;
const s = (q: Q, k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");

/**
 * Validasi permintaan otorisasi (OAuth 2.1 + MCP 2026-07-28). Dijalankan saat halaman dibuka DAN lagi saat keputusan dikirim,
 * karena isian tersembunyi formulir tidak dipercaya. Klien dan redirect_uri divalidasi lebih dulu; tanpa itu tidak ada redirect.
 */
export type TeksPeriksa = { tidakLengkap: string; identitasGagal: string; belumTerdaftar: string; redirectSalah: string; hanyaCode: string; pkce: string; resource: string };
const TEKS_PERIKSA_ID: TeksPeriksa = {
  tidakLengkap: "Tautan izin ini tidak lengkap (client_id atau redirect_uri kosong).",
  identitasGagal: "Identitas aplikasi tidak bisa diperiksa: {alasan}.",
  belumTerdaftar: "Aplikasi ini belum terdaftar di Nadi.",
  redirectSalah: "Alamat kembali (redirect_uri) tidak terdaftar untuk aplikasi ini.",
  hanyaCode: "Nadi hanya mendukung response_type=code.",
  pkce: "Aplikasi wajib memakai PKCE S256.",
  resource: "Token hanya bisa diminta untuk {resource}.",
};

export async function periksaPermintaan(q: Q, h: Headers, supabase: SupabaseClient, t: TeksPeriksa = TEKS_PERIKSA_ID): Promise<{ ok: true; p: Permintaan } | { ok: false; pesan: string }> {
  const clientId = s(q, "client_id");
  const redirectUri = s(q, "redirect_uri");
  if (!clientId || !redirectUri) return { ok: false, pesan: t.tidakLengkap };

  let namaKlien: string;
  let redirects: string[];
  if (adalahCimd(clientId)) {
    const c = await ambilCimd(clientId);
    if (!c.ok) return { ok: false, pesan: t.identitasGagal.replace("{alasan}", c.alasan) };
    namaKlien = c.klien.nama;
    redirects = c.klien.redirectUris;
  } else {
    const { data } = await supabase.rpc("oauth_klien_info", { p_client: clientId });
    const k = data as { nama: string; redirect_uris: string[] } | null;
    if (!k) return { ok: false, pesan: t.belumTerdaftar };
    namaKlien = k.nama;
    redirects = k.redirect_uris;
  }
  if (!redirects.includes(redirectUri)) return { ok: false, pesan: t.redirectSalah };

  if (s(q, "response_type") !== "code") return { ok: false, pesan: t.hanyaCode };
  const challenge = s(q, "code_challenge");
  if (s(q, "code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return { ok: false, pesan: t.pkce };
  const resource = resourceMcp(h);
  if (s(q, "resource") && s(q, "resource").replace(/\/$/, "").toLowerCase() !== resource) return { ok: false, pesan: t.resource.replace("{resource}", resource) };
  const diminta = s(q, "scope").split(/\s+/).filter(Boolean);
  const cakupan = diminta.length ? diminta.filter((c) => (CAKUPAN as readonly string[]).includes(c)) : ["nadi.baca"];
  if (!cakupan.includes("nadi.baca")) cakupan.unshift("nadi.baca");

  let hostKlien = clientId;
  try {
    hostKlien = adalahCimd(clientId) ? new URL(clientId).host : new URL(redirectUri).host;
  } catch {}
  return { ok: true, p: { clientId, namaKlien, hostKlien, redirectUri, state: s(q, "state"), challenge, cakupan, resource, iss: asal(h) } };
}

/** URL kembali ke aplikasi dengan parameter (code/error, state, iss). */
export function urlKembali(uri: string, param: Record<string, string>) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(param)) if (v) u.searchParams.set(k, v);
  return u.toString();
}
