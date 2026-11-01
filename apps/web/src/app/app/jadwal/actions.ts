"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { jamDesimal, rapikanPesanBatas, teksPeringatanTukar } from "@/lib/jadwal/pesan";
import { createClient } from "@/lib/supabase/server";

export type HasilJadwal = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const PERINGATAN: Record<string, string> = {
  tanpa_istirahat: "Beri istirahat minimal 30 menit; istirahat tidak dihitung jam kerja.",
  kurang_libur: "Orang ini belum punya hari libur yang cukup minggu ini.",
  lewat_40_minggu: "Jam minggu ini lewat 40 jam; selebihnya dihitung lembur.",
};

/** Tambah satu shift (F3-06). Batas PP 35/2021 ditegakkan simpan_shift di database. */
export async function tambahShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const isian = {
    orang: String(form.get("orang") ?? ""), tanggal: String(form.get("tanggal") ?? ""), mulai: String(form.get("mulai") ?? ""),
    selesai: String(form.get("selesai") ?? ""), istirahat: String(form.get("istirahat") ?? "0"), kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  if (!isian.orang) return { galat: "Pilih orangnya.", isian };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isian.tanggal) || !/^\d{2}:\d{2}$/.test(isian.mulai) || !/^\d{2}:\d{2}$/.test(isian.selesai)) return { galat: "Isi tanggal, jam mulai, dan jam selesai.", isian };
  const istirahat = Number(isian.istirahat);
  if (!Number.isInteger(istirahat) || istirahat < 0 || istirahat > 240) return { galat: "Istirahat 0 sampai 240 menit.", isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_shift", { p_orang: isian.orang, p_tanggal: isian.tanggal, p_mulai: isian.mulai, p_selesai: isian.selesai, p_istirahat: istirahat, p_topi: null, p_kunci: isian.kunci });
  if (error) {
    const pesan = error.code === "54000" ? `${rapikanPesanBatas(error.message)} Kurangi jamnya.` : error.code === "23P01" ? "Bertabrakan dengan shift lain orang ini." : error.code === "42501" ? "Hanya pemilik atau admin yang bisa menyusun jadwal." : error.code === "22023" ? error.message : "Jadwal belum tersimpan. Coba lagi; isianmu masih ada.";
    return { galat: pesan, isian: { ...isian, kunci: randomUUID() } };
  }
  revalidatePath("/app/jadwal");
  const d = data as { peringatan: string[]; lembur_menit: number };
  const catatan = [
    ...(d.lembur_menit > 0 ? [`Selebihnya ${jamDesimal(d.lembur_menit)} jam dihitung lembur dan menunggu persetujuan orangnya.`] : []),
    ...d.peringatan.map((p) => PERINGATAN[p] ?? p),
  ];
  return { pesan: ["Tersimpan.", ...catatan].join(" ") };
}

export async function batalkanShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_shift", { p_id: String(form.get("shift") ?? "") });
  if (error) return { galat: error.code === "22023" ? error.message : "Shift gagal dibatalkan. Coba lagi sebentar." };
  revalidatePath("/app/jadwal");
  return { pesan: "Shift dibatalkan." };
}

export async function salinMingguLalu(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const ke = String(form.get("minggu") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ke)) return { galat: "Minggu tidak dikenal." };
  const dari = new Date(`${ke}T00:00:00Z`);
  dari.setUTCDate(dari.getUTCDate() - 7);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salin_jadwal", { p_dari: dari.toISOString().slice(0, 10), p_ke: ke });
  if (error) return { galat: "Jadwal gagal disalin. Coba lagi sebentar." };
  revalidatePath("/app/jadwal");
  return { pesan: data ? `${data} shift disalin dari minggu lalu.` : "Tidak ada shift baru untuk disalin." };
}

export async function jawabLembur(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const setuju = form.get("jawab") === "setuju";
  const supabase = await createClient();
  const { error } = await supabase.rpc("jawab_lembur", { p_id: String(form.get("lembur") ?? ""), p_setuju: setuju });
  if (error) return { galat: "Jawaban belum tersimpan. Coba lagi sebentar." };
  revalidatePath("/app/jadwal");
  return { pesan: setuju ? "Tercatat: kamu setuju lembur." : "Tercatat: kamu tidak bisa lembur. Pemilik akan mengatur ulang." };
}

export type HasilAmbil = { pesan: string } | { galat: string } | { perlu: string[] } | null;

/** Staf menawarkan shift-nya yang belum mulai ke rekan bertopi sama (F3-06B). */
export async function tawarkanShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tawarkan_shift", { p_shift: String(form.get("shift") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? error.message : "Belum bisa ditawarkan. Coba lagi sebentar." };
  revalidatePath("/app/jadwal");
  return { pesan: "Ditawarkan ke rekan. Kamu tetap memegang shift ini sampai ada yang mengambil dan pemilik menyetujui." };
}

export async function batalTawaran(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_tawaran", { p_id: String(form.get("tawaran") ?? "") });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? error.message : "Tawaran belum dibatalkan. Coba lagi sebentar." };
  revalidatePath("/app/jadwal");
  return { pesan: "Tawaran dibatalkan." };
}

/** Ambil tawaran. Bila ada peringatan, kembalikan dulu kalimatnya; kirim ulang dengan konfirmasi untuk tetap mengambil. */
export async function ambilTawaran(_: HasilAmbil, form: FormData): Promise<HasilAmbil> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ambil_tawaran", { p_id: String(form.get("tawaran") ?? ""), p_konfirmasi: form.get("konfirmasi") === "1" });
  if (error) {
    return { galat: ["54000", "23P01", "55000", "P0002", "22023"].includes(error.code ?? "") ? rapikanPesanBatas(error.message) : "Belum bisa diambil. Coba lagi sebentar." };
  }
  const d = data as { status: string; peringatan?: string[]; lembur_menit?: number };
  if (d.status === "perlu_konfirmasi") return { perlu: teksPeringatanTukar(d.peringatan ?? [], d.lembur_menit ?? 0) };
  revalidatePath("/app/jadwal");
  return { pesan: "Diambil. Menunggu persetujuan pemilik." };
}
