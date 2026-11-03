"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { periksaPermintaan, urlKembali } from "./periksa";

/** Keputusan di halaman izin. Permintaan divalidasi ulang di sini; hasilnya kembali ke aplikasi dengan code, state, dan iss (RFC 9207). */
export async function putuskanIzin(_: string | null, form: FormData): Promise<string | null> {
  const t = ambilKamus(await bahasaAplikasi()).oauthIzin;
  const supabase = await createClient();
  const q = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const v = await periksaPermintaan(q, await headers(), supabase, t);
  if (!v.ok) return v.pesan;
  const { p } = v;
  if (q.keputusan !== "izinkan") redirect(urlKembali(p.redirectUri, { error: "access_denied", state: p.state, iss: p.iss }));
  const cakupan = p.cakupan.filter((c) => c === "nadi.baca" || form.get(`cakupan_${c}`) === "on");
  const { data, error } = await supabase.rpc("oauth_terbitkan_kode", {
    p_client: p.clientId, p_nama_klien: p.namaKlien, p_redirect: p.redirectUri, p_challenge: p.challenge,
    p_cakupan: cakupan, p_resource: p.resource, p_perusahaan: q.perusahaan,
  });
  if (error) console.error("oauth_terbitkan_kode", error.code, error.message);
  if (error || typeof data !== "string") return error?.code === "42501" ? t.bukanAnggota : t.gagal;
  redirect(urlKembali(p.redirectUri, { code: data, state: p.state, iss: p.iss }));
}
