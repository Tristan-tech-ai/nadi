"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cekIsianDaftar, jalurAman, pesanGalatAuth, type HasilForm } from "@/lib/auth-pesan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { asalTautan } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
// Belum masuk: bahasa dari cookie perangkat (bahasaAplikasi tanpa sesi).
const teksAuth = async () => ambilKamus(await bahasaAplikasi()).authPesan;

export async function masuk(_: HasilForm, form: FormData): Promise<HasilForm> {
  const email = teks(form, "email").toLowerCase();
  const sandi = String(form.get("sandi") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: sandi });
  if (error) return { galat: pesanGalatAuth(error.code, await teksAuth()), isian: { email } };
  await catatAktivitas(supabase, "masuk");
  const next = jalurAman(teks(form, "next"));
  // M-21: akun dengan verifikasi dua langkah wajib memasukkan kode dulu (database menutup usaha untuk sesi aal1).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/masuk/2fa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

/** Catat aktivitas akun dengan alamat dan perangkat peramban (dari kepala permintaan, bukan alamat server). Gagal diabaikan. */
async function catatAktivitas(supabase: Awaited<ReturnType<typeof createClient>>, jenis: "masuk" | "keluar" | "2fa.lolos" | "2fa.aktif" | "2fa.nonaktif" | "sesi.cabut") {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  await supabase.rpc("log_activity", { p_kind: jenis, p_ip: ip, p_ua: h.get("user-agent") });
}

/** Dipanggil peramban setelah langkah keamanan berhasil (kode 2FA benar, 2FA dinyalakan/dimatikan, perangkat lain dikeluarkan). */
export async function catatAktivitasKeamanan(jenis: "2fa.lolos" | "2fa.aktif" | "2fa.nonaktif" | "sesi.cabut") {
  await catatAktivitas(await createClient(), jenis);
}

/** Staf masuk tanpa email: kode usaha + ID staf + PIN 6 angka, dipetakan ke email sintetis buatan buat_akun_staf. */
export async function masukStaf(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = await teksAuth();
  const kode = teks(form, "kode").toUpperCase();
  const id = teks(form, "id").toUpperCase();
  const pin = String(form.get("pin") ?? "");
  const isian = { kode, id };
  if (!/^[A-Z0-9]{6}$/.test(kode)) return { galat: k.kodeSalah, isian };
  if (!/^S\d{3}$/.test(id)) return { galat: k.idSalah, isian };
  if (!/^\d{6}$/.test(pin)) return { galat: k.pinSalah, isian };
  const supabase = await createClient();
  const email = `${kode}-${id}@staf.nadi.local`.toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (error?.code === "user_banned") return { galat: k.pinTerkunci, isian };
  if (error?.code === "invalid_credentials") {
    // Q-13: PIN salah dicatat per akun; 5 kali dalam 15 menit mengunci akun staf 15 menit.
    const { data } = await supabase.rpc("pin_staf_gagal", { p_email: email });
    const h = data as { terkunci?: boolean; sisa?: number } | null;
    if (h?.terkunci) return { galat: k.pinTerkunci, isian };
    const sisa = h?.sisa !== undefined && h.sisa <= 2 ? isiTeks(k.sisa, { n: h.sisa }) : "";
    return { galat: `${k.tidakCocok}${sisa}`, isian };
  }
  if (error) return { galat: pesanGalatAuth(error.code, k), isian };
  redirect("/app");
}

export async function daftar(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = await teksAuth();
  const email = teks(form, "email").toLowerCase();
  const sandi = String(form.get("sandi") ?? "");
  const salah = cekIsianDaftar(email, sandi, k);
  if (salah) return { galat: salah, isian: { email } };
  const supabase = await createClient();
  const h = await headers();
  const { data, error } = await supabase.auth.signUp({ email, password: sandi, options: { emailRedirectTo: `${asalTautan(h)}/auth/konfirmasi?next=/app/mulai` } });
  if (error) return { galat: pesanGalatAuth(error.code, k), isian: { email } };
  // Konfirmasi email mati: sesi langsung ada. Menyala: minta pengguna membuka email.
  if (data.session) redirect("/app/mulai");
  return { info: isiTeks(k.cekEmail, { email }), isian: { email } };
}

export async function keluar() {
  const supabase = await createClient();
  await catatAktivitas(supabase, "keluar");
  await supabase.auth.signOut();
  redirect("/masuk");
}

/** U-07: masuk/daftar dengan Google (alur PKCE @supabase/ssr). Verifier disimpan di kuki oleh klien server, lalu /auth/konfirmasi menukar kodenya. */
export async function masukGoogle(form: FormData) {
  const next = jalurAman(teks(form, "next") || null, "/app");
  const supabase = await createClient();
  const h = await headers();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${asalTautan(h)}/auth/konfirmasi?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/masuk?galat=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
