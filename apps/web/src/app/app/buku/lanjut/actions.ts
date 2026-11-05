"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { barisBerulang, bulanKeTanggal } from "@/lib/buku/lanjut";
import { angkaIsian } from "@/lib/buku/laporan";
import { formatRupiah } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilLanjut = { pesan: string } | { galat: string } | null;

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tanggal = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(teks(f, k)) ? teks(f, k) : null);
const uuid = (f: FormData, k: string) => (/^[0-9a-f-]{36}$/i.test(teks(f, k)) ? teks(f, k) : null);
const kurs = (f: FormData, k: string) => {
  const s = teks(f, k).replace(/\s|Rp/gi, "");
  const n = /^\d{1,3}(\.\d{3})+(,\d{1,4})?$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : /^\d+([.,]\d{1,4})?$/.test(s) ? Number(s.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function siap() {
  const bahasa = await bahasaAplikasi();
  const k = ambilKamus(bahasa).bukuLanjutPesan;
  const supabase = await createClient();
  const salah = (e: { code?: string; message: string }) => ({ galat: e.code === "42501" ? k.hanya : isiTeks(k.galatDb, { pesan: e.message }) });
  const rp = (n: number) => formatRupiah(n, { bahasa });
  return { k, supabase, salah, rp };
}

const segarkan = () => revalidatePath("/app/buku/lanjut");

export async function simpanAnggaran(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const dari = bulanKeTanggal(teks(f, "dari"));
  const nominal = angkaIsian(teks(f, "nominal"));
  if (!dari || !teks(f, "akun")) return { galat: k.isian };
  if (nominal === null || nominal < 0) return { galat: k.angka };
  const { data, error } = await supabase.rpc("set_budget", { p_kode: teks(f, "akun"), p_bulan: dari, p_nominal: nominal, p_sampai: bulanKeTanggal(teks(f, "sampai")) });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.anggaran, { kode: teks(f, "akun"), n: Number(data) }) };
}

export async function simpanDimensi(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_dimension", { p_jenis: teks(f, "jenis"), p_nama: teks(f, "nama"), p_aktif: true });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.dimensi, { nama: teks(f, "nama") }) };
}

export async function simpanAturanTag(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const d = uuid(f, "dimensi");
  if (!d) return { galat: k.isian };
  const { error } = await supabase.rpc("save_tag_rule", { p_dimension: d, p_kata: teks(f, "kata"), p_aktif: true });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.aturan };
}

export async function terapkanAturan(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const { data, error } = await supabase.rpc("apply_tag_rules", { p_dari: tanggal(f, "dari"), p_sampai: tanggal(f, "sampai") });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.terapkan, { n: Number(data) }) };
}

export async function simpanBerulang(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const jumlah = angkaIsian(teks(f, "jumlah"));
  const baris = jumlah === null ? null : barisBerulang(teks(f, "debit"), teks(f, "kredit"), jumlah);
  if (!baris) return { galat: jumlah === null ? k.angka : k.isian };
  const { error } = await supabase.rpc("save_recurring_journal", {
    p_nama: teks(f, "nama"), p_tiap: teks(f, "tiap"), p_mulai: tanggal(f, "mulai"), p_sampai: tanggal(f, "selesai"), p_baris: baris, p_dimension: uuid(f, "dimensi"),
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.berulang };
}

export async function jalankanBerulang(): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const { data, error } = await supabase.rpc("run_recurring_journals");
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.jalankan, { n: Number(data) }) };
}

export async function aturBerulang(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("set_recurring_active", { p_id: uuid(f, "id"), p_aktif: teks(f, "aktif") === "ya" });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.aktif };
}

export async function simpanKurs(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const n = kurs(f, "kurs");
  if (n === null) return { galat: k.angka };
  const { error } = await supabase.rpc("save_fx_rate", { p_valuta: teks(f, "valuta"), p_tanggal: tanggal(f, "tanggal"), p_kurs: n, p_sumber: teks(f, "sumber") });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.kurs, { v: teks(f, "valuta").toUpperCase() }) };
}

export async function revaluasi(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah, rp } = await siap();
  const n = kurs(f, "kurs");
  if (n === null) return { galat: k.angka };
  const { data, error } = await supabase.rpc("revalue_fx", { p_tanggal: tanggal(f, "tanggal"), p_kurs: n, p_sumber: teks(f, "sumber") });
  if (error) return salah(error);
  const r = data as { invoice: number; selisih: number };
  segarkan();
  return { pesan: r.invoice ? isiTeks(k.revaluasi, { n: r.invoice, rp: rp(r.selisih) }) : k.revaluasiNol };
}

export async function lunasiEkspor(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah, rp } = await siap();
  const n = kurs(f, "kurs");
  if (n === null) return { galat: k.angka };
  const { data, error } = await supabase.rpc("settle_export_invoice", {
    p_id: uuid(f, "id"), p_tanggal: tanggal(f, "tanggal"), p_kurs: n, p_kurs_sumber: teks(f, "sumber"), p_akun: teks(f, "akun") === "1-100" ? "1-100" : "1-110",
  });
  if (error) return salah(error);
  const r = data as { diterima?: number; selisih_kurs?: number };
  segarkan();
  revalidatePath("/app/invoice");
  return { pesan: isiTeks(k.lunas, { rp: rp(Number(r.diterima ?? 0)), selisih: rp(Number(r.selisih_kurs ?? 0)) }) };
}

export async function catatAntarusaha(_: HasilLanjut, f: FormData): Promise<HasilLanjut> {
  const { k, supabase, salah } = await siap();
  const nominal = angkaIsian(teks(f, "nominal"));
  if (nominal === null || nominal <= 0) return { galat: k.angka };
  const { error } = await supabase.rpc("post_intercompany", {
    p_mitra: uuid(f, "mitra"), p_tanggal: tanggal(f, "tanggal"), p_jenis: teks(f, "jenis"), p_nominal: nominal, p_keterangan: teks(f, "keterangan"),
    p_kunci: uuid(f, "kunci") ?? randomUUID(),
  });
  if (error) return error.code === "42501" ? { galat: k.hanyaPemilik } : salah(error);
  segarkan();
  revalidatePath("/app/buku");
  return { pesan: k.antar };
}
