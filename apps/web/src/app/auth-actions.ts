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
