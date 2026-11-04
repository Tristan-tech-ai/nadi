"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { angkaWa } from "@/lib/rekrut/keputusan";
import { createClient } from "@/lib/supabase/server";

export type HasilJual = { pesan: string } | { galat: string } | null;

async function teksJual() {
  const t = ambilKamus(await bahasaAplikasi()).jualPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}
const galat = (k: Awaited<ReturnType<typeof teksJual>>, e: { code?: string; message: string }): HasilJual =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514"].includes(e.code ?? "") ? k.db(e.message) : k.gagal });

/** Penawaran atau pesanan baru dari baris (uraian, jumlah, harga, produk opsional). */
export async function buatDokumen(_: HasilJual, form: FormData): Promise<HasilJual> {
  const k = await teksJual();
  const jenis = String(form.get("jenis") ?? "penawaran");
  const pelanggan = String(form.get("pelanggan") ?? "").trim();
  const hpIsian = String(form.get("hp") ?? "").trim();
  const hp = hpIsian ? angkaWa(hpIsian) : null;
  if (!pelanggan) return { galat: k.tulisPelanggan };
  if (hpIsian && !hp) return { galat: k.waSalah };
  const uraian = form.getAll("uraian").map(String), jumlah = form.getAll("jumlah").map(String), harga = form.getAll("harga").map(String), produk = form.getAll("produk").map(String);
  const baris = uraian.map((u, i) => ({ uraian: u.trim(), jumlah: Number((jumlah[i] ?? "").replace(",", ".")), harga: angkaIsian(harga[i] ?? "") ?? NaN,
    ...(/^[0-9a-f-]{36}$/.test(produk[i] ?? "") ? { produk: produk[i] } : {}) })).filter((b) => b.uraian || Number.isFinite(b.harga) && b.harga > 0);
  if (!baris.length || baris.some((b) => !b.uraian || !(b.jumlah > 0) || !Number.isFinite(b.harga))) return { galat: k.barisLengkap };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_dokumen_jual", { p_jenis: jenis, p_induk: null, p_pelanggan: pelanggan, p_hp: hp, p_baris: baris,
    p_berlaku: String(form.get("berlaku") ?? "") || null, p_catatan: String(form.get("catatan") ?? "") || null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/jual");
  return { pesan: isiTeks(k.terbit, { nomor: String((data as { nomor: string }).nomor) }) };
}

/** Lanjutkan dokumen: penawaran jadi pesanan, pesanan jadi surat jalan. */
export async function lanjutkan(_: HasilJual, form: FormData): Promise<HasilJual> {
  const k = await teksJual();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_dokumen_jual", { p_jenis: String(form.get("jenis") ?? ""), p_induk: String(form.get("induk") ?? ""), p_pelanggan: null, p_hp: null,
    p_baris: null, p_berlaku: null, p_catatan: null, p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/jual");
  return { pesan: isiTeks(k.terbit, { nomor: String((data as { nomor: string }).nomor) }) };
}

export async function uangMuka(_: HasilJual, form: FormData): Promise<HasilJual> {
  const k = await teksJual();
  const jumlah = angkaIsian(String(form.get("jumlah") ?? ""));
  if (!jumlah || jumlah <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("terima_uang_muka", { p_pesanan: String(form.get("pesanan") ?? ""), p_jumlah: jumlah, p_cara: String(form.get("cara") ?? "transfer"),
    p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/jual");
  return { pesan: k.uangMukaTercatat };
}

/** Invoice dari pesanan atau surat jalan; persen < 100 = invoice termin. */
export async function tagihkan(_: HasilJual, form: FormData): Promise<HasilJual> {
  const k = await teksJual();
  const persen = Number(String(form.get("persen") ?? "100").replace(",", "."));
  if (!(persen > 0 && persen <= 100)) return { galat: k.persenRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_dari_dokumen", { p_dokumen: String(form.get("dokumen") ?? ""), p_persen: persen,
    p_jatuh_tempo: String(form.get("jatuh_tempo") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/jual");
  revalidatePath("/app/invoice");
  return { pesan: isiTeks(k.invoiceTerbit, { nomor: String((data as { nomor: string }).nomor) }) };
}

/** Retur satu baris invoice (nota kredit). */
export async function retur(_: HasilJual, form: FormData): Promise<HasilJual> {
  const k = await teksJual();
  const jumlah = Number(String(form.get("jumlah") ?? "").replace(",", "."));
  const indeks = Number(form.get("indeks"));
  if (!(jumlah > 0) || !Number.isInteger(indeks) || indeks < 1) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retur_jual", { p_invoice: String(form.get("invoice") ?? ""), p_baris: [{ indeks, jumlah }],
    p_alasan: String(form.get("alasan") ?? ""), p_kunci: String(form.get("kunci") ?? "") || randomUUID() });
  if (error) return galat(k, error);
  revalidatePath("/app/invoice");
  return { pesan: isiTeks(k.returTercatat, { nomor: String((data as { nomor: string }).nomor) }) };
}
