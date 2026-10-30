"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HasilForm } from "@/lib/auth-pesan";
import { createClient } from "@/lib/supabase/server";

const INDUSTRI = new Set(["fnb", "toko", "kantor", "bengkel", "klinik", "konstruksi", "gudang", "hotel", "salon", "laundry", "lainnya"]);

/** Buat perusahaan lewat RPC (menulis klaim pid/prn ke app_metadata), lalu segarkan sesi agar JWT membawa klaim baru. */
export async function buatPerusahaan(_: HasilForm, form: FormData): Promise<HasilForm> {
  const nama = String(form.get("nama") ?? "").trim();
  const industri = String(form.get("industri") ?? "");
  if (nama.length < 2) return { galat: "Nama usaha minimal 2 huruf.", isian: { nama, industri } };
  if (!INDUSTRI.has(industri)) return { galat: "Pilih jenis usaha yang paling dekat.", isian: { nama, industri } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("buat_perusahaan", { p_nama: nama, p_industri: industri });
  if (error) return { galat: error.code === "54000" ? "Akun ini sudah mencapai batas 20 usaha." : "Nadi gagal membuat usaha. Coba lagi sebentar.", isian: { nama, industri } };
  await supabase.auth.refreshSession();
  // Topi bawaan jenis usaha (paket industri); butuh klaim pid baru, jadi setelah refreshSession.
  await supabase.rpc("pasang_paket", { p_kode: industri });
  redirect("/app");
}

export async function tambahOrang(_: HasilForm, form: FormData): Promise<HasilForm> {
  const nama = String(form.get("nama") ?? "").trim();
  if (nama.length < 2) return { galat: "Nama minimal 2 huruf." };
  const supabase = await createClient();
  const { data: sesi } = await supabase.auth.getClaims();
  const pid = (sesi?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { error } = await supabase.from("orang").insert({ perusahaan_id: pid, nama });
  if (error) return { galat: "Nadi gagal menambah orang. Hanya pemilik atau admin yang bisa." };
  revalidatePath("/app/orang");
  return {};
}

export async function buatAkunStaf(_: HasilForm, form: FormData): Promise<HasilForm> {
  const orang = String(form.get("orang") ?? "");
  const pin = String(form.get("pin") ?? "");
  if (!/^\d{6}$/.test(pin)) return { galat: "PIN harus 6 angka." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_akun_staf", { p_orang: orang, p_pin: pin });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa membuat akun staf." : "Nadi gagal membuat akun. Coba lagi sebentar." };
  const r = data as { kode: string; id_staf: string };
  revalidatePath("/app/orang");
  return { info: `Akun siap. Staf masuk di /masuk/staf dengan kode ${r.kode}, ID ${r.id_staf}, dan PIN yang barusan kamu isi.` };
}

export async function pindahPerusahaan(form: FormData) {
  const id = String(form.get("perusahaan") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pindah_perusahaan", { p_perusahaan: id });
  if (!error) await supabase.auth.refreshSession();
  redirect(error ? "/app/perusahaan?galat=1" : "/app");
}
