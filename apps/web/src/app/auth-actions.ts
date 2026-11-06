"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { bersihkanKode, cekIsianDaftar, jalurAman, pesanGalatAuth, sudahTerdaftar, type HasilForm } from "@/lib/auth-pesan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { kodeEmailAktif } from "@/lib/auth/kode-email";
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
  return lanjutSetelahMasuk(supabase, jalurAman(teks(form, "next")));
}

/** Setelah sesi ada: catat, lalu minta kode 2FA dulu bila akun memakainya (M-21: database menutup usaha untuk sesi aal1). */
async function lanjutSetelahMasuk(supabase: Awaited<ReturnType<typeof createClient>>, next: string): Promise<never> {
  await catatAktivitas(supabase, "masuk");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/masuk/2fa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

type JenisKode = "masuk" | "lupa" | "daftar";
const jenisKode = (f: FormData): JenisKode => (["lupa", "daftar"].includes(teks(f, "jenis")) ? (teks(f, "jenis") as JenisKode) : "masuk");

/**
 * Kode angka lewat email sebagai cadangan tautan (tautan bisa gagal: dibuka di perangkat lain sehingga PKCE tidak cocok,
 * atau sudah dibuka pemindai tautan email). Masuk: signInWithOtp tanpa membuat akun baru. Lupa: resetPasswordForEmail
 * (Supabase tidak membedakan email terdaftar atau tidak). Daftar: kirim ulang email konfirmasi pendaftaran.
 */
export async function kirimKode(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = await teksAuth();
  const email = teks(form, "email").toLowerCase();
  const jenis = jenisKode(form);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { galat: k.emailSalah, isian: { email } };
  const supabase = await createClient();
  const asal = asalTautan(await headers());
  const next = jalurAman(teks(form, "next"));
  const { error } = jenis === "lupa"
    ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${asal}/auth/konfirmasi?next=/masuk/sandi-baru` })
    : jenis === "daftar"
      ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${asal}/auth/konfirmasi?next=/app/mulai` } })
      : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${asal}/auth/konfirmasi?next=${encodeURIComponent(next)}` } });
  const kode = kodeEmailAktif();
  if (error?.code === "over_email_send_rate_limit") return { galat: k.kodeTertahan, isian: { email }, kode, waktu: Date.now() };
  if (error) return { galat: pesanGalatAuth(error.code, k), isian: { email } };
  const a = ambilKamus(await bahasaAplikasi()).auth;
  return { info: isiTeks(kode ? a.kodeTerkirim : a.tautanTerkirim, { email }), isian: { email }, kode, waktu: Date.now() };
}

/** Cocokkan kode dari email. Lupa sandi memakai jenis recovery lalu ke halaman sandi baru; masuk dan daftar memakai jenis email. */
export async function cocokkanKode(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = await teksAuth();
  const email = teks(form, "email").toLowerCase();
  const jenis = jenisKode(form);
  const kode = bersihkanKode(teks(form, "kode"));
  if (!kode) return { galat: k.kodeFormat, isian: { email } };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: kode, type: jenis === "lupa" ? "recovery" : "email" });
  if (error) return { galat: pesanGalatAuth(error.code === "otp_expired" || error.status === 403 ? "otp_expired" : error.code, k), isian: { email } };
  if (jenis === "lupa") redirect("/masuk/sandi-baru");
  return lanjutSetelahMasuk(supabase, jenis === "daftar" ? "/app/mulai" : jalurAman(teks(form, "next")));
}

/** Kata sandi baru setelah kode atau tautan atur ulang (sesi recovery). Tanpa sesi: kembali minta kode. */
export async function aturSandiBaru(_: HasilForm, form: FormData): Promise<HasilForm> {
  const k = await teksAuth();
  const sandi = String(form.get("sandi") ?? "");
  if (sandi.length < 8) return { galat: k.sandiPendek };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { galat: k.sesiHabis };
  const { error } = await supabase.auth.updateUser({ password: sandi });
  if (error) return { galat: pesanGalatAuth(error.code, k) };
  return lanjutSetelahMasuk(supabase, "/app");
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
  // Konfirmasi email mati: sesi langsung ada. Menyala: minta pengguna membuka email atau mengetik kodenya.
  if (data.session) redirect("/app/mulai");
  // Email sudah terdaftar: Supabase diam-diam tidak mengirim email (log user_repeated_signup), jadi arahkan ke masuk.
  if (sudahTerdaftar(data.user)) return { galat: k.sudahTerdaftar, isian: { email } };
  const kode = kodeEmailAktif();
  return { info: isiTeks(kode ? k.cekEmailKode : k.cekEmail, { email }), isian: { email }, kode, waktu: 1 };
}

export async function keluar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const tamu = data?.claims?.is_anonymous === true;
  if (!tamu) await catatAktivitas(supabase, "keluar");
  await supabase.auth.signOut();
  redirect(tamu ? "/demo" : "/masuk");
}

/**
 * L-03: buka usaha contoh di aplikasi sungguhan lewat sesi anonim Supabase (baca saja, ditegakkan database). Yang sudah masuk
 * dengan akun sendiri langsung ke aplikasinya; sesi akunnya tidak diganti diam-diam.
 */
export async function masukCoba() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/app");
  const { error } = await supabase.auth.signInAnonymously();
  redirect(error ? "/demo?galat=coba" : "/app");
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
