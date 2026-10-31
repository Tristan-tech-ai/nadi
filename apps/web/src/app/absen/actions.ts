"use server";

import { formatJam } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

export type HasilAbsen = { ok?: string; galat?: string };
// Kode galat yang pesannya ditulis untuk pengguna di fungsi absen_catat (bahasa sehari-hari).
const PESAN_PENGGUNA = new Set(["P0001", "P0002", "22023", "42501", "28000", "54000"]);

/** Catat absen setelah cek wajah lolos di perangkat. Kode QR divalidasi database (TOTP, langkah sekarang/sebelumnya). */
export async function catatAbsen(tempat: string, kode: string, jenis: "absen.masuk" | "absen.pulang", wajah: { lulus: boolean; kedip: boolean; menoleh: string }): Promise<HasilAbsen> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("absen_catat", { p_tempat: tempat, p_kode: kode, p_jenis: jenis, p_wajah: wajah });
  if (error) return { galat: PESAN_PENGGUNA.has(error.code) ? error.message : "Nadi gagal mencatat absen. Coba lagi sebentar." };
  // Kode salah dikembalikan sebagai data (bukan galat) agar percobaannya tercatat untuk penguncian (Q-13).
  if (data && typeof data === "object" && "galat" in data) return { galat: String((data as { galat: string }).galat) };
  const saat = new Date((data as { saat: string }).saat);
  return { ok: `${jenis === "absen.masuk" ? "Absen masuk" : "Absen pulang"} tercatat ${formatJam(saat, await zonaSesi())}.` };
}
