"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaDesimal, angkaKurs, formatUsd } from "@/lib/ekspor/hitung";
import { formatRupiah } from "@/lib/format";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilEkspor = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const KOLOM_BARIS = ["uraian", "hs", "jumlah", "satuan", "harga", "bersih", "kotor", "koli"] as const;
const KOLOM = ["alamat_penjual", "pembeli", "alamat_pembeli", "negara", "incoterm", "tempat_incoterm", "pelabuhan_muat", "pelabuhan_tujuan",
  "kurs", "kurs_sumber", "kurs_tanggal", "jatuh_tempo", "catatan"] as const;

async function teksEkspor() {
  const bahasa = await bahasaAplikasi();
  const t: Kamus["eksporPesan"] = ambilKamus(bahasa).eksporPesan;
  const db = (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan }));
  return { t, db, bahasa };
}

/** Terbitkan invoice ekspor. Angka akhir (total USD, rupiah, berat) dihitung ulang database; formulir hanya pratinjau. */
export async function buatInvoiceEkspor(_: HasilEkspor, form: FormData): Promise<HasilEkspor> {
  const k = await teksEkspor();
  const isian: Record<string, string> = { kunci: String(form.get("kunci") ?? "") || randomUUID() };
  for (const c of KOLOM) isian[c] = String(form.get(c) ?? "").trim();
  const kolom = Object.fromEntries(KOLOM_BARIS.map((c) => [c, form.getAll(c).map((v) => String(v).trim())])) as Record<(typeof KOLOM_BARIS)[number], string[]>;
  const n = kolom.uraian.length;
  isian.n = String(n);
  for (let i = 0; i < n; i++) for (const c of KOLOM_BARIS) isian[`${c}.${i}`] = kolom[c][i] ?? "";
  const baris = Array.from({ length: n }, (_, i) => ({
    uraian: kolom.uraian[i] ?? "", hs: kolom.hs[i] ?? "", satuan: kolom.satuan[i] ?? "",
    jumlah: angkaDesimal(kolom.jumlah[i] ?? ""), harga_usd: angkaDesimal(kolom.harga[i] ?? ""),
    berat_bersih_kg: angkaDesimal(kolom.bersih[i] ?? ""), berat_kotor_kg: angkaDesimal(kolom.kotor[i] ?? ""), koli: Number(kolom.koli[i] ?? ""),
  })).filter((b) => b.uraian || Number.isFinite(b.harga_usd));
  if (!isian.pembeli) return { galat: k.t.tulisPembeli, isian };
  if (baris.length === 0) return { galat: k.t.minimalBaris, isian };
  if (baris.some((b) => !b.uraian || !b.satuan || ![b.jumlah, b.harga_usd, b.berat_bersih_kg, b.berat_kotor_kg, b.koli].every(Number.isFinite))) {
    return { galat: k.t.barisLengkap, isian };
  }
  const kurs = angkaKurs(isian.kurs);
  if (!Number.isFinite(kurs)) return { galat: k.t.kursSalah, isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_invoice_ekspor", {
    p: {
      alamat_penjual: isian.alamat_penjual, pembeli: isian.pembeli, alamat_pembeli: isian.alamat_pembeli, negara: isian.negara,
      incoterm: isian.incoterm, tempat_incoterm: isian.tempat_incoterm, pelabuhan_muat: isian.pelabuhan_muat || null,
      pelabuhan_tujuan: isian.pelabuhan_tujuan || null, kurs, kurs_sumber: isian.kurs_sumber, kurs_tanggal: isian.kurs_tanggal || null,
      jatuh_tempo: isian.jatuh_tempo || null, catatan: isian.catatan || null,
      baris: baris.map((b) => ({ ...b, hs: b.hs || null })),
    },
    p_kunci: isian.kunci,
  });
  if (error) {
    const galat = error.code === "22023" || error.code === "P0002" ? k.db(error.message) : error.code === "42501" ? k.t.hanyaPengelola : k.t.gagal;
    return { galat, isian };
  }
  const r = data as { nomor: string; total_usd: number; total_rupiah: number; sudah: boolean };
  revalidatePath("/app/ekspor");
  if (r.sudah) return { pesan: isiTeks(k.t.sudah, { nomor: r.nomor }) };
  return { pesan: isiTeks(k.t.terbit, { nomor: r.nomor, usd: formatUsd(Math.round(Number(r.total_usd) * 100)), rupiah: formatRupiah(Number(r.total_rupiah), { bahasa: k.bahasa }) }) };
}

export async function batalkanInvoiceEkspor(_: HasilEkspor, form: FormData): Promise<HasilEkspor> {
  const k = await teksEkspor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_invoice_ekspor", { p_id: String(form.get("invoice") ?? ""), p_alasan: String(form.get("alasan") ?? "").trim() });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? k.db(error.message) : error.code === "42501" ? k.t.hanyaPengelola : k.t.gagalBatal };
  revalidatePath("/app/ekspor");
  return { pesan: k.t.dibatalkan };
}
