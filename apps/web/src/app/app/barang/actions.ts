"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { uraiAtribut, uraiTingkat } from "@/lib/stok/harga";
import { createClient } from "@/lib/supabase/server";

export type HasilBarang = { pesan: string } | { galat: string } | null;

async function teksBarang() {
  const t = ambilKamus(await bahasaAplikasi()).barangPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}
const galat = (k: Awaited<ReturnType<typeof teksBarang>>, e: { code?: string; message: string }) =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514", "23505", "23503"].includes(e.code ?? "") ? k.db(e.message) : k.gagal });
const jumlahIsian = (t: string) => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Produk baru (M-02): kode, nama, jenis, satuan, harga jual, barcode, satuan besar opsional (mis. 1 dus = 24 pcs). */
export async function simpanProduk(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const harga = angkaIsian(String(form.get("harga") ?? ""));
  if (harga === null || harga < 0) return { galat: k.hargaRusak };
  const satuanBesar = String(form.get("satuan_besar") ?? "").trim();
  const faktor = jumlahIsian(String(form.get("faktor") ?? ""));
  const p: Record<string, unknown> = {
    kode: String(form.get("kode") ?? "").trim(), nama: String(form.get("nama") ?? "").trim(), jenis: String(form.get("jenis") ?? "barang"),
    satuan: String(form.get("satuan") ?? "").trim() || "pcs", harga_jual: harga, barcode: String(form.get("barcode") ?? "").trim() || null,
    boleh_minus: form.get("boleh_minus") === "on",
  };
  // M-02B: varian (induk + atribut) dan harga grosir bertingkat.
  const tingkat = uraiTingkat(String(form.get("tingkat") ?? ""));
  if (tingkat === null) return { galat: k.tingkatRusak };
  if (tingkat.length) p.harga_tingkat = tingkat;
  const induk = String(form.get("induk") ?? "");
  if (/^[0-9a-f-]{36}$/.test(induk)) {
    const atribut = uraiAtribut(String(form.get("atribut") ?? ""));
    if (!atribut || !Object.keys(atribut).length) return { galat: k.atributRusak };
    p.induk = induk;
    p.atribut = atribut;
  }
  if (satuanBesar) {
    if (!faktor || faktor <= 0) return { galat: k.faktorRusak };
    p.satuan_lain = [{ satuan: satuanBesar, faktor, harga: null }];
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_produk", { p });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: isiTeks(k.produkTersimpan, { nama: String(p.nama) }) };
}

export async function simpanGudang(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_gudang", { p_kode: String(form.get("kode") ?? ""), p_nama: String(form.get("nama") ?? ""), p_utama: form.get("utama") === "on" });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: k.gudangTersimpan };
}

/** Stok masuk dengan biaya total; jurnal persediaan / akun bayar dibuat database. */
export async function stokMasuk(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const jumlah = jumlahIsian(String(form.get("jumlah") ?? ""));
  const nilai = angkaIsian(String(form.get("nilai") ?? ""));
  if (!jumlah || jumlah <= 0) return { galat: k.jumlahRusak };
  if (nilai === null || nilai < 0) return { galat: k.hargaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("stok_masuk", {
    p_produk: String(form.get("produk") ?? ""), p_gudang: String(form.get("gudang") ?? "") || null, p_jumlah: jumlah, p_nilai: nilai,
    p_tanggal: String(form.get("tanggal") ?? "") || null, p_akun: String(form.get("akun") ?? "2-100"), p_keterangan: String(form.get("keterangan") ?? "") || null,
    p_batch: String(form.get("batch") ?? "") || null, p_kunci: String(form.get("kunci") ?? "") || randomUUID(),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: k.masukTercatat };
}

export async function pindahStok(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const jumlah = jumlahIsian(String(form.get("jumlah") ?? ""));
  if (!jumlah || jumlah <= 0) return { galat: k.jumlahRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stok", {
    p_produk: String(form.get("produk") ?? ""), p_dari: String(form.get("dari") ?? ""), p_ke: String(form.get("ke") ?? ""), p_jumlah: jumlah,
    p_kunci: String(form.get("kunci") ?? "") || randomUUID(),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: k.pindahTercatat };
}

/** Opname satu produk di satu gudang: jumlah fisik hasil hitung. */
export async function opnameStok(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const fisik = jumlahIsian(String(form.get("fisik") ?? ""));
  if (fisik === null || fisik < 0) return { galat: k.jumlahRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("opname_stok", {
    p_gudang: String(form.get("gudang") ?? "") || null, p_baris: [{ produk: String(form.get("produk") ?? ""), fisik }], p_kunci: String(form.get("kunci") ?? "") || randomUUID(),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: (data as { berubah: number }).berubah ? k.opnameTercatat : k.opnameSama };
}

/** Lokasi rak/bin satu produk di satu gudang (M-02B). Kosong = hapus lokasi. */
export async function aturLokasi(_: HasilBarang, form: FormData): Promise<HasilBarang> {
  const k = await teksBarang();
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_lokasi_stok", { p_produk: String(form.get("produk") ?? ""), p_gudang: String(form.get("gudang") ?? ""),
    p_lokasi: String(form.get("lokasi") ?? "").trim() || null });
  if (error) return galat(k, error);
  revalidatePath("/app/barang");
  return { pesan: k.lokasiTersimpan };
}
