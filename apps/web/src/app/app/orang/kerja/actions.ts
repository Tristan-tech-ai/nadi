"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-11: HR administrasi. Semua penulisan lewat RPC yang memeriksa peran (pemilik/admin) dan aturan di database.
export type HasilHr = { pesan: string } | { galat: string } | null;
const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tanggal = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(teks(f, k)) ? teks(f, k) : null);

async function galat(e: { code?: string; message: string }) {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  return { galat: e.code === "42501" ? k.hanya : e.code === "22023" || e.code === "P0002" ? e.message : k.gagal };
}

export async function ubahProfil(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ubah_profil_kerja", {
    p_orang: teks(f, "orang"), p_jabatan: teks(f, "jabatan"), p_level: teks(f, "level"), p_departemen: teks(f, "departemen"),
    p_atasan: teks(f, "atasan") || null, p_status: teks(f, "status"), p_kontrak_sampai: tanggal(f, "kontrak_sampai"),
    p_jenis: teks(f, "jenis") || "perubahan", p_berlaku_dari: tanggal(f, "berlaku_dari"), p_catatan: teks(f, "catatan"),
  });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: (data as { riwayat: boolean }).riwayat ? k.profilRiwayat : k.profilTersimpan };
}

export async function beriSp(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const masa = Number(teks(f, "masa") || 6);
  const { data, error } = await supabase.rpc("beri_sp", {
    p_orang: teks(f, "orang"), p_tanggal: tanggal(f, "tanggal"), p_pelanggaran: teks(f, "pelanggaran"), p_dasar: teks(f, "dasar"),
    p_masa_bulan: masa, p_terakhir: f.get("terakhir") === "on", p_kunci: teks(f, "kunci"),
  });
  if (error) return galat(error);
  const d = data as { tingkat: number; berlaku_sampai: string };
  revalidatePath("/app/orang/kerja");
  return { pesan: isiTeks(k.spTercatat, { n: d.tingkat, sampai: d.berlaku_sampai.split("-").reverse().join("-") }) };
}

export async function mulaiPeriksa(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mulai_daftar_periksa", { p_orang: teks(f, "orang"), p_jenis: teks(f, "jenis") });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: isiTeks(k.periksaDibuat, { n: data as number }) };
}

export async function centangPeriksa(_: HasilHr, f: FormData): Promise<HasilHr> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("centang_periksa", { p_id: teks(f, "id"), p_selesai: teks(f, "selesai") === "1" });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return null;
}
