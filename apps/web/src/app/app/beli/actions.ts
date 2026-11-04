"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilBeli = { pesan: string } | { galat: string } | null;

async function teksBeli() {
  const t = ambilKamus(await bahasaAplikasi()).beliPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}
const galat = (k: Awaited<ReturnType<typeof teksBeli>>, e: { code?: string; message: string }): HasilBeli =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514", "23505"].includes(e.code ?? "") ? k.db(e.message) : k.gagal });

/** Permintaan atau pesanan pembelian baru dari baris (uraian, jumlah, harga, produk opsional). */
export async function buatDokumenBeli(_: HasilBeli, form: FormData): Promise<HasilBeli> {
  const k = await teksBeli();
  const pemasok = String(form.get("pemasok") ?? "").trim();
  if (!pemasok) return { galat: k.tulisPemasok };
  const uraian = form.getAll("uraian").map(String), jumlah = form.getAll("jumlah").map(String), harga = form.getAll("harga").map(String), produk = form.getAll("produk").map(String);
  const baris = uraian.map((u, i) => ({ uraian: u.trim(), jumlah: Number((jumlah[i] ?? "").replace(",", ".")), harga: angkaIsian(harga[i] ?? "") ?? NaN,
    ...(/^[0-9a-f-]{36}$/.test(produk[i] ?? "") ? { produk: produk[i] } : {}) })).filter((b) => b.uraian || (Number.isFinite(b.harga) && b.harga > 0));
  if (!baris.length || baris.some((b) => !b.uraian || !(b.jumlah > 0) || !Number.isFinite(b.harga))) return { galat: k.barisLengkap };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_dokumen_beli", { p_jenis: String(form.get("jenis") ?? "pesanan_beli"), p_induk: null, p_pemasok: pemasok, p_baris: baris,
    p_catatan: String(form.get("catatan") ?? "") || null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/beli");
  return { pesan: isiTeks(k.terbit, { nomor: String((data as { nomor: string }).nomor) }) };
}

/** Lanjutkan: permintaan jadi PO, PO jadi penerimaan barang (stok masuk). */
export async function lanjutkanBeli(_: HasilBeli, form: FormData): Promise<HasilBeli> {
  const k = await teksBeli();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_dokumen_beli", { p_jenis: String(form.get("jenis") ?? ""), p_induk: String(form.get("induk") ?? ""), p_pemasok: null, p_baris: null,
    p_catatan: null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/beli");
  revalidatePath("/app/barang");
  return { pesan: isiTeks(k.terbit, { nomor: String((data as { nomor: string }).nomor) }) };
}

/** Tagihan pemasok: dari penerimaan (dicocokkan ke PO) atau tanpa dokumen. */
export async function catatTagihan(_: HasilBeli, form: FormData): Promise<HasilBeli> {
  const k = await teksBeli();
  const total = angkaIsian(String(form.get("total") ?? ""));
  if (!total || total <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_tagihan_beli", { p_pemasok: String(form.get("pemasok") ?? "") || null, p_nomor: String(form.get("nomor") ?? "") || null,
    p_tanggal: String(form.get("tanggal") ?? "") || null, p_jatuh_tempo: String(form.get("jatuh_tempo") ?? "") || null, p_total: total,
    p_dokumen: String(form.get("dokumen") ?? "") || null, p_akun: null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/beli");
  const selisih = Number((data as { selisih?: number }).selisih ?? 0);
  return { pesan: selisih ? isiTeks(k.tagihanSelisih, { selisih: new Intl.NumberFormat("id-ID").format(selisih) }) : k.tagihanTercatat };
}

export async function bayarTagihan(_: HasilBeli, form: FormData): Promise<HasilBeli> {
  const k = await teksBeli();
  const jumlah = angkaIsian(String(form.get("jumlah") ?? ""));
  if (!jumlah || jumlah <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bayar_tagihan_beli", { p_tagihan: String(form.get("tagihan") ?? ""), p_jumlah: jumlah, p_cara: String(form.get("cara") ?? "transfer"),
    p_tanggal: String(form.get("tanggal") ?? "") || null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/beli");
  return { pesan: k.bayarTercatat };
}

/** Retur ke pemasok (nota debit): stok keluar senilai rata-rata, hutang berkurang. */
export async function returBeli(_: HasilBeli, form: FormData): Promise<HasilBeli> {
  const k = await teksBeli();
  const jumlah = Number(String(form.get("jumlah") ?? "").replace(",", "."));
  const harga = angkaIsian(String(form.get("harga") ?? ""));
  if (!(jumlah > 0) || !harga || harga <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retur_beli", { p_tagihan: String(form.get("tagihan") ?? ""), p_produk: String(form.get("produk") ?? ""), p_jumlah: jumlah,
    p_harga: harga, p_alasan: String(form.get("alasan") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/beli");
  revalidatePath("/app/barang");
  return { pesan: isiTeks(k.returTercatat, { nomor: String((data as { nomor: string }).nomor) }) };
}
