"use server";

import { revalidatePath } from "next/cache";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { JENIS_SURAT, pahamiKalimat, susunSurat, type Isian, type JenisSurat } from "@/lib/surat/kalimat";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export type DrafSurat = {
  jenis: JenisSurat | "";
  orang: string;
  tujuan: string;
  keperluan: string;
  mulai: string;
  lamaHari: string;
  kandidat: { id: string; nama: string }[];
  kurang: Isian[];
};
export type HasilPaham = { draf: DrafSurat; kunci: number } | { galat: string } | null;
export type HasilSurat = { pesan: string } | { galat: string } | null;

const teksSuratKeluar = async () => ambilKamus(await bahasaAplikasi()).suratKeluarPesan;

/** Pahami kalimat jadi isian surat (pengurai aturan, tanpa model). Tidak menyimpan apa pun. */
export async function pahami(_: HasilPaham, form: FormData): Promise<HasilPaham> {
  const k = await teksSuratKeluar();
  const kalimat = String(form.get("kalimat") ?? "").trim().slice(0, 300);
  if (kalimat.length < 5) return { galat: k.kalimatPendek };
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ data: orang }, zona] = await Promise.all([
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const h = pahamiKalimat(kalimat, (orang ?? []) as { id: string; nama: string }[], hariIni(new Date(), zona));
  return {
    kunci: Date.now(),
    draf: {
      jenis: h.jenis ?? "", orang: h.orang?.id ?? "", tujuan: h.tujuan ?? "", keperluan: h.keperluan ?? "", mulai: h.mulai ?? "",
      lamaHari: h.lamaHari ? String(h.lamaHari) : "", kandidat: h.kandidat, kurang: h.kurang,
    },
  };
}

/** Simpan draf surat dari isian yang sudah diperiksa pemilik. Isi surat disusun di server dari templat. */
export async function simpanDraf(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const k = await teksSuratKeluar();
  const jenis = String(form.get("jenis") ?? "") as JenisSurat;
  if (!(jenis in JENIS_SURAT)) return { galat: k.pilihJenis };
  const isian = {
    orang: String(form.get("orang") ?? ""),
    tujuan: String(form.get("tujuan") ?? "").trim().slice(0, 120),
    keperluan: String(form.get("keperluan") ?? "").trim().slice(0, 200),
    mulai: String(form.get("mulai") ?? ""),
  };
  const lama = Number(form.get("lamaHari") || 0);
  const kurang = JENIS_SURAT[jenis].wajib.filter((i) => i !== "jenis" && !isian[i as keyof typeof isian]);
  const NAMA_ISIAN: Record<Isian, string> = { jenis: k.iJenis, orang: k.iOrang, tujuan: k.iTujuan, keperluan: k.iKeperluan, mulai: k.iMulai };
  if (kurang.length) return { galat: isiTeks(k.lengkapi, { isian: kurang.map((i) => NAMA_ISIAN[i]).join(", ") }) };
  if (isian.mulai && !/^\d{4}-\d{2}-\d{2}$/.test(isian.mulai)) return { galat: k.tanggalKalender };
  if (!Number.isInteger(lama) || lama < 0 || lama > 365) return { galat: k.lamaTugas };
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ data: usaha }, { data: o }] = await Promise.all([
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).maybeSingle(),
    supabase.from("orang").select("nama").eq("id", isian.orang).maybeSingle(),
  ]);
  if (!o) return { galat: k.orangTidakAda };
  const surat = susunSurat(jenis, { usaha: usaha?.nama ?? "usaha", nama: o.nama, tujuan: isian.tujuan, keperluan: isian.keperluan, mulai: isian.mulai || null, lamaHari: lama || null });
  const bidang = { tujuan: isian.tujuan || null, keperluan: isian.keperluan || null, mulai: isian.mulai || null, lama_hari: lama || null };
  const { error } = await supabase.rpc("simpan_surat", { p_id: null, p_jenis: jenis, p_orang: isian.orang, p_bidang: bidang, p_judul: surat.judul, p_isi: surat.isi });
  if (error) return { galat: error.code === "42501" ? k.hanyaBuat : k.gagalDraf };
  revalidatePath("/app/surat-keluar");
  return { pesan: k.drafTersimpan };
}

export async function terbitkan(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const k = await teksSuratKeluar();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("terbitkan_surat", { p_id: String(form.get("surat") ?? "") });
  if (error) return { galat: error.code === "42501" ? k.hanyaTerbit : error.code === "22023" ? k.sudahTerbit : k.gagalTerbit };
  revalidatePath("/app/surat-keluar");
  return { pesan: isiTeks(k.terbitNomor, { nomor: (data as { nomor: string }).nomor }) };
}

export async function batalkan(_: HasilSurat, form: FormData): Promise<HasilSurat> {
  const k = await teksSuratKeluar();
  const alasan = String(form.get("alasan") ?? "").trim();
  if (alasan.length < 3) return { galat: k.tulisAlasan };
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_surat", { p_id: String(form.get("surat") ?? ""), p_alasan: alasan });
  if (error) return { galat: error.code === "42501" ? k.hanyaBatal : k.gagalBatal };
  revalidatePath("/app/surat-keluar");
  return { pesan: k.dibatalkan };
}
