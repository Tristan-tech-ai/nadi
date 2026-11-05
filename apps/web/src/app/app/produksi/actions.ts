"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { formatRupiah } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilProduksi = { pesan: string } | { galat: string } | null;

async function teks() {
  const b = await bahasaAplikasi();
  return { k: ambilKamus(b).produksiPesan, rp: (n: number) => formatRupiah(n, { bahasa: b }) };
}
type K = Awaited<ReturnType<typeof teks>>["k"];
const galat = (k: K, e: { code?: string; message: string }): HasilProduksi =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514", "23505"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
/** Angka isian: 2,5 atau 2.5 atau 1.000 (ribuan) menjadi bilangan. */
const angka = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  return Number(/^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s.replace(",", "."));
};
const segar = () => { revalidatePath("/app/produksi"); revalidatePath("/app/barang"); };

export async function simpanResep(_: HasilProduksi, form: FormData): Promise<HasilProduksi> {
  const { k } = await teks();
  const hasilQty = angka(form.get("jumlah_hasil"));
  if (!(hasilQty > 0)) return { galat: k.angkaRusak };
  const bp = form.getAll("bahan").map(String), bj = form.getAll("bahan_jumlah").map(angka);
  const bahan = bp.map((p, i) => ({ produk: p, jumlah: bj[i] })).filter((b) => b.produk);
  if (!bahan.length) return { galat: k.bahanKurang };
  if (bahan.some((b) => !(b.jumlah > 0))) return { galat: k.angkaRusak };
  const lp = form.getAll("lain").map(String), lj = form.getAll("lain_jumlah").map(angka), lk = form.getAll("lain_jenis").map(String);
  const lain = lp.map((p, i) => ({ produk: p, jumlah: lj[i], jenis: lk[i] })).filter((b) => b.produk);
  if (lain.some((b) => !(b.jumlah > 0))) return { galat: k.angkaRusak };
  const konv = angka(String(form.get("biaya_konversi") ?? "0").replace(/\./g, "") || "0");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_bom", { p: { produk: String(form.get("produk") ?? ""), jumlah_hasil: hasilQty, biaya_konversi: Number.isFinite(konv) ? Math.round(konv) : 0, bahan, hasil_lain: lain } });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.bomTersimpan };
}

export async function buatPerintahKerja(_: HasilProduksi, form: FormData): Promise<HasilProduksi> {
  const { k } = await teks();
  const jumlah = angka(form.get("jumlah"));
  if (!(jumlah > 0)) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_work_order", { p_produk: String(form.get("produk") ?? ""), p_jumlah: jumlah, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  const { data: w } = await supabase.from("work_order").select("nomor").eq("id", data as string).single();
  segar();
  return { pesan: isiTeks(k.pkDibuat, { nomor: String(w?.nomor ?? "") }) };
}

/** Langkah perintah kerja: ambil bahan, selesai (dengan jumlah jadi sebenarnya), atau batal. */
export async function langkahPerintahKerja(_: HasilProduksi, form: FormData): Promise<HasilProduksi> {
  const { k, rp } = await teks();
  const wo = String(form.get("wo") ?? ""), langkah = String(form.get("langkah") ?? "");
  const supabase = await createClient();
  if (langkah === "ambil") {
    const { data, error } = await supabase.rpc("issue_work_order", { p_wo: wo });
    if (error) return galat(k, error);
    segar();
    return { pesan: isiTeks(k.diambil, { rp: rp(Number((data as { biaya_bahan: number }).biaya_bahan)) }) };
  }
  if (langkah === "selesai") {
    const hasil = angka(form.get("hasil"));
    if (!(hasil > 0)) return { galat: k.angkaRusak };
    const { data, error } = await supabase.rpc("complete_work_order", { p_wo: wo, p_hasil: hasil });
    if (error) return galat(k, error);
    segar();
    const d = data as { biaya_total?: number; selisih?: number };
    return { pesan: isiTeks(k.selesai, { rp: rp(Number(d.biaya_total ?? 0)), selisih: rp(Number(d.selisih ?? 0)) }) };
  }
  const { error } = await supabase.rpc("cancel_work_order", { p_wo: wo });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.dibatalkan };
}

export async function rakitBongkar(_: HasilProduksi, form: FormData): Promise<HasilProduksi> {
  const { k } = await teks();
  const jumlah = angka(form.get("jumlah"));
  if (!(jumlah > 0)) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const fn = form.get("aksi") === "bongkar" ? "disassemble_product" : "assemble_product";
  const { data, error } = await supabase.rpc(fn, { p_produk: String(form.get("produk") ?? ""), p_jumlah: jumlah, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  segar();
  return { pesan: isiTeks(k.tercatat, { nomor: String((data as { nomor: string }).nomor) }) };
}
