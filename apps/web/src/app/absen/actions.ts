"use server";

import { formatJam } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

export type HasilAbsen = { ok?: string; galat?: string };
// Kode galat yang pesannya ditulis untuk pengguna di fungsi absen_catat (bahasa sehari-hari).
const PESAN_PENGGUNA = new Set(["P0001", "P0002", "22023", "42501", "28000", "54000"]);

/** Catat absen setelah cek wajah lolos di perangkat. Kode QR divalidasi database (TOTP, langkah sekarang/sebelumnya). */
export async function catatAbsen(tempat: string, kode: string, jenis: "absen.masuk" | "absen.pulang", wajah: { lulus: boolean; kedip: boolean; menoleh: string }): Promise<HasilAbsen> {
  const bahasa = await bahasaAplikasi();
  const k = ambilKamus(bahasa).absenPesan;
  const db = (pesan: string) => isiTeks(k.galatDb, { pesan });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("absen_catat", { p_tempat: tempat, p_kode: kode, p_jenis: jenis, p_wajah: wajah });
  if (error) return { galat: PESAN_PENGGUNA.has(error.code) ? db(error.message) : k.gagal };
  // Kode salah dikembalikan sebagai data (bukan galat) agar percobaannya tercatat untuk penguncian (Q-13).
  if (data && typeof data === "object" && "galat" in data) return { galat: db(String((data as { galat: string }).galat)) };
  const saat = new Date((data as { saat: string }).saat);
  return { ok: isiTeks(k.tercatat, { jenis: jenis === "absen.masuk" ? k.masuk : k.pulang, jam: formatJam(saat, await zonaSesi()) }) };
}
