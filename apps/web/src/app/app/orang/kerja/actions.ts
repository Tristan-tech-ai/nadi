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

// M-11B: bidang kustom, delegasi persetujuan, SP menjadi surat keluar, templat dokumen bebas.
export async function simpanBidang(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const pilihan = teks(f, "pilihan").split(",").map((x) => x.trim()).filter(Boolean);
  const { error } = await supabase.rpc("simpan_bidang_kustom", {
    p_id: null, p_label: teks(f, "label"), p_tipe: teks(f, "tipe"), p_pilihan: pilihan.length ? pilihan : null, p_staf_lihat: f.get("staf_lihat") === "on", p_aktif: true,
  });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: k.bidangTersimpan };
}

export async function isiNilai(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("isi_nilai_kustom", { p_orang: teks(f, "orang"), p_bidang: teks(f, "bidang"), p_nilai: teks(f, "nilai") });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: k.nilaiTersimpan };
}

export async function aturDelegasi(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_delegasi", { p_dari: teks(f, "dari"), p_ke: teks(f, "ke"), p_mulai: tanggal(f, "mulai"), p_selesai: tanggal(f, "selesai") });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: k.delegasiTersimpan };
}

export async function terbitkanSp(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("terbitkan_sp", { p_sp: teks(f, "sp") });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  revalidatePath("/app/surat-keluar");
  return { pesan: isiTeks(k.spTerbit, { nomor: (data as { nomor: string }).nomor }) };
}

export async function simpanTemplat(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_templat_dokumen", { p_nama: teks(f, "nama"), p_judul: teks(f, "judul"), p_isi: String(f.get("isi") ?? "") });
  if (error) return galat(error);
  revalidatePath("/app/orang/kerja");
  return { pesan: k.templatTersimpan };
}

export async function buatDokumen(_: HasilHr, f: FormData): Promise<HasilHr> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("buat_dokumen", { p_templat: teks(f, "templat"), p_orang: teks(f, "orang") });
  if (error) return galat(error);
  revalidatePath("/app/surat-keluar");
  return { pesan: k.dokumenDibuat };
}
