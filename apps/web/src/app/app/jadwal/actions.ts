"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { kunciBaris, ringkasSimpan, usulkan, type BarisUsulan, type DataUsulan } from "@/lib/jadwal/kebutuhan";
import { jamDesimal, rapikanPesanBatas, teksPeringatanTukar } from "@/lib/jadwal/pesan";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilJadwal = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

/** Pesan jadwal dalam bahasa pengguna. Pesan database (batas UU 27/2026 Pasal 116) ditulis dalam bahasa Indonesia: di bahasa lain dibungkus. */
async function teksJadwal() {
  const bahasa = await bahasaAplikasi();
  const t: Kamus["jadwalPesan"] = ambilKamus(bahasa).jadwalPesan;
  const db = (pesan: string) => (bahasa === "id" ? rapikanPesanBatas(pesan) : isiTeks(t.galatDb, { pesan }));
  return { t, bahasa, db };
}

/** Tambah satu shift (F3-06). Batas UU 27/2026 Pasal 116 ditegakkan simpan_shift di database. */
export async function tambahShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const isian = {
    orang: String(form.get("orang") ?? ""), tanggal: String(form.get("tanggal") ?? ""), mulai: String(form.get("mulai") ?? ""),
    selesai: String(form.get("selesai") ?? ""), istirahat: String(form.get("istirahat") ?? "0"), kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  const { t, bahasa, db } = await teksJadwal();
  if (!isian.orang) return { galat: t.pilihOrang, isian };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isian.tanggal) || !/^\d{2}:\d{2}$/.test(isian.mulai) || !/^\d{2}:\d{2}$/.test(isian.selesai)) return { galat: t.isiTanggalJam, isian };
  const istirahat = Number(isian.istirahat);
  if (!Number.isInteger(istirahat) || istirahat < 0 || istirahat > 240) return { galat: t.istirahat, isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_shift", { p_orang: isian.orang, p_tanggal: isian.tanggal, p_mulai: isian.mulai, p_selesai: isian.selesai, p_istirahat: istirahat, p_topi: null, p_kunci: isian.kunci });
  if (error) {
    const pesan = error.code === "54000" ? `${db(error.message)}${t.kurangiJam}` : error.code === "23P01" ? t.tabrakan : error.code === "42501" ? t.hanyaPengelola : error.code === "22023" ? db(error.message) : t.gagalSimpan;
    return { galat: pesan, isian: { ...isian, kunci: randomUUID() } };
  }
  revalidatePath("/app/jadwal");
  const d = data as { peringatan: string[]; lembur_menit: number };
  const catatan = [
    ...(d.lembur_menit > 0 ? [isiTeks(t.lemburSisa, { jam: jamDesimal(d.lembur_menit, bahasa) })] : []),
    ...d.peringatan.map((p) => t.peringatan[p as keyof typeof t.peringatan] ?? p),
  ];
  return { pesan: [t.tersimpan, ...catatan].join(" ") };
}

export async function batalkanShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t, db } = await teksJadwal();
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_shift", { p_id: String(form.get("shift") ?? "") });
  if (error) return { galat: error.code === "22023" ? db(error.message) : t.gagalBatal };
  revalidatePath("/app/jadwal");
  return { pesan: t.shiftBatal };
}

export async function salinMingguLalu(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t } = await teksJadwal();
  const ke = String(form.get("minggu") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ke)) return { galat: t.mingguTak };
  const dari = new Date(`${ke}T00:00:00Z`);
  dari.setUTCDate(dari.getUTCDate() - 7);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("salin_jadwal", { p_dari: dari.toISOString().slice(0, 10), p_ke: ke });
  if (error) return { galat: t.gagalSalin };
  revalidatePath("/app/jadwal");
  return { pesan: data ? isiTeks(t.disalin, { n: Number(data) }) : t.tidakAdaSalin };
}

export async function jawabLembur(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t } = await teksJadwal();
  const setuju = form.get("jawab") === "setuju";
  const supabase = await createClient();
  const { error } = await supabase.rpc("jawab_lembur", { p_id: String(form.get("lembur") ?? ""), p_setuju: setuju });
  if (error) return { galat: t.gagalJawab };
  revalidatePath("/app/jadwal");
  return { pesan: setuju ? t.lemburSetuju : t.lemburTidak };
}

export type HasilAmbil = { pesan: string } | { galat: string } | { perlu: string[] } | null;

/** Staf menawarkan shift-nya yang belum mulai ke rekan bertopi sama (F3-06B). */
export async function tawarkanShift(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t, db } = await teksJadwal();
  const supabase = await createClient();
  const { error } = await supabase.rpc("tawarkan_shift", { p_shift: String(form.get("shift") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? db(error.message) : t.gagalTawar };
  revalidatePath("/app/jadwal");
  return { pesan: t.ditawarkan };
}

export async function batalTawaran(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t, db } = await teksJadwal();
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_tawaran", { p_id: String(form.get("tawaran") ?? "") });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? db(error.message) : t.gagalBatalTawaran };
  revalidatePath("/app/jadwal");
  return { pesan: t.tawaranBatal };
}

/** Ambil tawaran. Bila ada peringatan, kembalikan dulu kalimatnya; kirim ulang dengan konfirmasi untuk tetap mengambil. */
export async function ambilTawaran(_: HasilAmbil, form: FormData): Promise<HasilAmbil> {
  const { t, bahasa, db } = await teksJadwal();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ambil_tawaran", { p_id: String(form.get("tawaran") ?? ""), p_konfirmasi: form.get("konfirmasi") === "1" });
  if (error) {
    return { galat: ["54000", "23P01", "55000", "P0002", "22023"].includes(error.code ?? "") ? db(error.message) : t.gagalAmbil };
  }
  const d = data as { status: string; peringatan?: string[]; lembur_menit?: number };
  if (d.status === "perlu_konfirmasi") return { perlu: teksPeringatanTukar(d.peringatan ?? [], d.lembur_menit ?? 0, t, bahasa) };
  revalidatePath("/app/jadwal");
  return { pesan: t.diambil };
}

const HARI_ISI = ["0", "1", "2", "3", "4", "5", "6"];

/** Kebutuhan orang per topi per hari dan jam (F3-06C, tahap 0: isian pemilik). */
export async function aturKebutuhan(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t, db } = await teksJadwal();
  const hari = form.getAll("hari").map(String).filter((h) => HARI_ISI.includes(h)).map(Number);
  const mulai = String(form.get("mulai") ?? "");
  const selesai = String(form.get("selesai") ?? "");
  const istirahat = Number(form.get("istirahat") ?? 0);
  const butuh = Number(form.get("butuh") ?? 0);
  if (!form.get("topi")) return { galat: t.pilihTopi };
  if (hari.length === 0) return { galat: t.pilihHari };
  if (!/^\d{2}:\d{2}$/.test(mulai) || !/^\d{2}:\d{2}$/.test(selesai)) return { galat: t.isiJam };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("atur_kebutuhan", { p_topi: String(form.get("topi")), p_hari: hari, p_mulai: mulai, p_selesai: selesai, p_istirahat: istirahat, p_butuh: butuh });
  if (error) return { galat: ["22023", "P0002"].includes(error.code ?? "") ? db(error.message) : error.code === "42501" ? t.hanyaKebutuhan : t.gagalKebutuhan };
  revalidatePath("/app/jadwal");
  return { pesan: isiTeks(t.kebutuhanTersimpan, { n: Number(data) }) };
}

export async function hentiKebutuhan(_: HasilJadwal, form: FormData): Promise<HasilJadwal> {
  const { t } = await teksJadwal();
  const supabase = await createClient();
  const { error } = await supabase.rpc("henti_kebutuhan", { p_id: String(form.get("kebutuhan") ?? "") });
  if (error) return { galat: t.gagalUmum };
  revalidatePath("/app/jadwal");
  return { pesan: t.tidakDipakai };
}

export type HasilUsulan = { usulan: { baris: BarisUsulan[]; kurang: string[] } } | { simpan: { pesan: string; gagal: string[] } } | { galat: string } | null;

/** Usulkan jadwal minggu itu dari kebutuhan (susunJadwal). Belum menyimpan apa pun. */
export async function usulkanJadwal(_: HasilUsulan, form: FormData): Promise<HasilUsulan> {
  const { t } = await teksJadwal();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("data_usulan_jadwal", { p_mulai: String(form.get("minggu") ?? "") || null });
  if (error || !data) return { galat: error?.code === "42501" ? t.hanyaSusun : t.gagalBaca };
  const d = data as DataUsulan;
  if (d.kebutuhan.length === 0) return { galat: t.isiKebutuhan };
  return { usulan: usulkan(d) };
}

/** Simpan usulan satu per satu lewat simpan_shift; baris yang ditolak database dilaporkan dengan alasannya. */
export async function simpanUsulan(_: HasilUsulan, form: FormData): Promise<HasilUsulan> {
  const { t, db } = await teksJadwal();
  let baris: BarisUsulan[];
  try {
    baris = JSON.parse(String(form.get("baris") ?? "[]"));
  } catch {
    return { galat: t.usulanRusak };
  }
  if (!Array.isArray(baris) || baris.length === 0 || baris.length > 300) return { galat: t.tidakAdaUsulan };
  const supabase = await createClient();
  const hasil: { nama: string; tanggal: string; mulai: string; selesai: string; galat?: string }[] = [];
  for (const b of baris) {
    const { error } = await supabase.rpc("simpan_shift", {
      p_orang: String(b.orang), p_tanggal: String(b.tanggal), p_mulai: String(b.mulai), p_selesai: String(b.selesai), p_istirahat: Number(b.istirahat),
      p_topi: b.topi ? String(b.topi) : null, p_kunci: kunciBaris(String(b.orang), String(b.tanggal), String(b.mulai)),
    });
    hasil.push({ nama: String(b.nama), tanggal: String(b.tanggal), mulai: String(b.mulai), selesai: String(b.selesai),
      galat: error ? (["54000", "23P01", "22023", "P0002"].includes(error.code ?? "") ? (error.code === "23P01" ? t.tabrakan : db(error.message)) : t.belumTersimpan) : undefined });
  }
  revalidatePath("/app/jadwal");
  return { simpan: ringkasSimpan(hasil) };
}
