"use server";

import { createClient } from "@/lib/supabase/server";

export type KodeKios = { tempat: string; kode: string; sisa: number } | { galat: string };

/** Kode absen saat ini untuk layar kios (pemilik/admin). Rahasia TOTP tetap di database. */
export async function ambilKodeKios(): Promise<KodeKios> {
  const supabase = await createClient();
  const { data: tempat, error: e1 } = await supabase.rpc("tempat_absen_utama");
  if (e1 || !tempat) return { galat: "Layar absen hanya bisa dibuka pemilik atau admin. Masuk dengan akun pemilik di tablet ini." };
  const { data, error } = await supabase.rpc("kode_absen", { p_tempat: tempat });
  if (error || !data) return { galat: "Kode absen gagal dimuat. Periksa internet tablet ini." };
  const d = data as { kode: string; sisa_detik: number };
  return { tempat: tempat as string, kode: d.kode, sisa: d.sisa_detik };
}
