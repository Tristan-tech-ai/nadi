"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { waktuZona } from "@/lib/rekrut/ics";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export type HasilRekrut = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).rekrutmenPesan;
}
type K = Awaited<ReturnType<typeof teks>>;
const galat = (k: K, e: { code?: string; message: string }): HasilRekrut =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514", "23505"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
/** Rupiah/angka bulat dari isian: "2.500.000" atau "2500000"; kosong = null; rusak = NaN. */
const bulat = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/[.\s]/g, "");
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
};
const segar = () => revalidatePath("/app/rekrutmen");

export async function jadwalkanWawancara(_: HasilRekrut, form: FormData): Promise<HasilRekrut> {
  const k = await teks();
  const sesi = await wajibPerusahaan();
  const mulai = waktuZona(String(form.get("waktu") ?? ""), await zonaUsahaIni(sesi.perusahaanId));
  if (!mulai) return { galat: k.waktuRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("schedule_interview", { p_lamaran: String(form.get("lamaran") ?? ""), p_mulai: mulai.toISOString(),
    p_durasi: Number(form.get("durasi") ?? 30), p_lokasi: String(form.get("lokasi") ?? ""), p_catatan: String(form.get("catatan") ?? "") || null,
    p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  segar();
  const n = Number((data as { bentrok?: number }).bentrok ?? 0);
  return { pesan: n ? isiTeks(k.dijadwalkanBentrok, { n }) : k.dijadwalkan };
}

export async function batalWawancara(_: HasilRekrut, form: FormData): Promise<HasilRekrut> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_interview", { p_id: String(form.get("id") ?? "") });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.dibatalkan };
}

export async function simpanRencana(_: HasilRekrut, form: FormData): Promise<HasilRekrut> {
  const k = await teks();
  const target = bulat(form.get("target")), anggaran = bulat(form.get("anggaran"));
  if (target === null || Number.isNaN(target) || Number.isNaN(anggaran)) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_manpower_plan", { p_topi: String(form.get("topi") ?? ""), p_tahun: Number(form.get("tahun")), p_headcount: target,
    p_anggaran: anggaran ?? 0, p_catatan: String(form.get("catatan") ?? "") || null });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.rencanaTersimpan };
}

export async function simpanRincianLowongan(_: HasilRekrut, form: FormData): Promise<HasilRekrut> {
  const k = await teks();
  const min = bulat(form.get("gaji_min")), max = bulat(form.get("gaji_max"));
  if (Number.isNaN(min) || Number.isNaN(max)) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_job_details", { p_lowongan: String(form.get("lowongan") ?? ""), p: {
    kota: String(form.get("kota") ?? ""), wilayah: String(form.get("wilayah") ?? ""), jenis: String(form.get("jenis") ?? "FULL_TIME"), gaji_min: min, gaji_max: max,
    gaji_satuan: String(form.get("gaji_satuan") ?? "MONTH"), berlaku_sampai: String(form.get("berlaku_sampai") ?? "") || null, terindeks: form.get("terindeks") === "ya" } });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.rincianTersimpan };
}
