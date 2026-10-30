"use server";

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
  redirect("/app");
}

export async function pindahPerusahaan(form: FormData) {
  const id = String(form.get("perusahaan") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pindah_perusahaan", { p_perusahaan: id });
  if (!error) await supabase.auth.refreshSession();
  redirect(error ? "/app/perusahaan?galat=1" : "/app");
}
