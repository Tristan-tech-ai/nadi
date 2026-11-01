"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilSerah = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const ALASAN = ["mundur", "kontrak_selesai", "lainnya"];
const tanggal = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Catat orang berhenti; database menyusun paket serah terima dalam satu transaksi (F3-07). */
export async function catatBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const isian = {
    orang: String(form.get("orang") ?? ""), surat: String(form.get("surat") ?? ""), efektif: String(form.get("efektif") ?? ""),
    alasan: String(form.get("alasan") ?? ""), kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  if (!isian.orang) return { galat: "Pilih orang yang berhenti.", isian };
  if (!tanggal(isian.surat) || !tanggal(isian.efektif)) return { galat: "Isi tanggal surat dan tanggal efektif dari kalender.", isian };
  if (isian.efektif < isian.surat) return { galat: "Tanggal efektif tidak boleh sebelum tanggal surat.", isian };
  if (!ALASAN.includes(isian.alasan)) return { galat: "Pilih alasan berhenti.", isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catat_berhenti", { p_orang: isian.orang, p_surat: isian.surat, p_efektif: isian.efektif, p_alasan: isian.alasan, p_kunci: isian.kunci });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa mencatat karyawan berhenti." : error.code === "22023" || error.code === "P0002" ? error.message : "Paket belum tersimpan. Coba lagi; isianmu masih ada.", isian };
  revalidatePath("/app/serah-terima");
  const kurang = ((data as { peringatan: string[] }).peringatan ?? []).includes("kurang_30_hari");
  return { pesan: kurang ? "Paket serah terima disiapkan. Catatan: tanggal efektif kurang dari 30 hari setelah surat (PP 35/2021 Pasal 36 huruf i); tetap tersimpan bila kalian sudah sepakat." : "Paket serah terima disiapkan." };
}

export async function pindahkanSemua(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pindahkan_ke_pengganti", { p_berhenti: String(form.get("berhenti") ?? "") });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik atau admin yang bisa memindah kerja." : "Kerja gagal dipindah. Coba lagi sebentar." };
  revalidatePath("/app/serah-terima");
  return { pesan: data ? `${data} kerja dipindah ke penggantinya.` : "Tidak ada kerja yang punya pengganti untuk dipindah." };
}

export async function tandaiButir(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const status = String(form.get("status") ?? "");
  const pengganti = String(form.get("pengganti") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_butir", { p_butir: String(form.get("butir") ?? ""), p_status: status, p_pengganti: pengganti || null });
  if (error) return { galat: error.code === "22023" ? error.message : "Butir gagal disimpan. Coba lagi sebentar." };
  revalidatePath("/app/serah-terima");
  return { pesan: "Tersimpan." };
}

export async function batalkanBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const alasan = String(form.get("alasan") ?? "").trim();
  if (alasan.length < 3) return { galat: "Tulis alasan pembatalan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_berhenti", { p_berhenti: String(form.get("berhenti") ?? ""), p_alasan: alasan });
  if (error) return { galat: "Gagal membatalkan. Coba lagi sebentar." };
  revalidatePath("/app/serah-terima");
  return { pesan: "Proses berhenti dibatalkan. Akses tidak akan dicabut." };
}
