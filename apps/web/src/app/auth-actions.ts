"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cekIsianDaftar, jalurAman, pesanGalatAuth, type HasilForm } from "@/lib/auth-pesan";
import { createClient } from "@/lib/supabase/server";

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function masuk(_: HasilForm, form: FormData): Promise<HasilForm> {
  const email = teks(form, "email").toLowerCase();
  const sandi = String(form.get("sandi") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: sandi });
  if (error) return { galat: pesanGalatAuth(error.code), isian: { email } };
  redirect(jalurAman(teks(form, "next")));
}

/** Staf masuk tanpa email: kode usaha + ID staf + PIN 6 angka, dipetakan ke email sintetis buatan buat_akun_staf. */
export async function masukStaf(_: HasilForm, form: FormData): Promise<HasilForm> {
  const kode = teks(form, "kode").toUpperCase();
  const id = teks(form, "id").toUpperCase();
  const pin = String(form.get("pin") ?? "");
  const isian = { kode, id };
  if (!/^[A-Z0-9]{6}$/.test(kode)) return { galat: "Kode usaha berisi 6 huruf atau angka. Tanyakan ke pemilik.", isian };
  if (!/^S\d{3}$/.test(id)) return { galat: "ID staf seperti S001. Tanyakan ke pemilik.", isian };
  if (!/^\d{6}$/.test(pin)) return { galat: "PIN berisi 6 angka.", isian };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: `${kode}-${id}@staf.nadi.local`.toLowerCase(), password: pin });
  if (error) return { galat: error.code === "invalid_credentials" ? "Kode, ID, atau PIN tidak cocok. Periksa lagi, atau minta pemilik mengatur ulang PIN." : pesanGalatAuth(error.code), isian };
  redirect("/app");
}

export async function daftar(_: HasilForm, form: FormData): Promise<HasilForm> {
  const email = teks(form, "email").toLowerCase();
  const sandi = String(form.get("sandi") ?? "");
  const salah = cekIsianDaftar(email, sandi);
  if (salah) return { galat: salah, isian: { email } };
  const supabase = await createClient();
  const h = await headers();
  const asal = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({ email, password: sandi, options: { emailRedirectTo: `${asal}/auth/konfirmasi?next=/app/mulai` } });
  if (error) return { galat: pesanGalatAuth(error.code), isian: { email } };
  // Konfirmasi email mati: sesi langsung ada. Menyala: minta pengguna membuka email.
  if (data.session) redirect("/app/mulai");
  return { info: `Hampir selesai. Buka email dari Nadi di ${email} dan ketuk tautannya untuk mengaktifkan akun.`, isian: { email } };
}

export async function keluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}
