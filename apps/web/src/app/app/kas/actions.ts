"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { angkaIsian } from "@/lib/buku/laporan";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { uraiMutasiCsv } from "@/lib/invoice/cocok";
import { createClient } from "@/lib/supabase/server";

export type HasilKas = { pesan: string } | { galat: string } | null;

async function teksKas() {
  const t = ambilKamus(await bahasaAplikasi()).kasPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}
const galat = (k: Awaited<ReturnType<typeof teksKas>>, e: { code?: string; message: string }): HasilKas =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "23514", "23505"].includes(e.code ?? "") ? k.db(e.message) : k.gagal });
const teks = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const segar = () => { revalidatePath("/app/kas"); revalidatePath("/app/buku"); };

export async function tambahRekening(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_rekening", { p_nama: teks(form, "nama"), p_jenis: teks(form, "jenis") || "bank", p_nomor_akhir: teks(form, "nomor_akhir") || null });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.rekeningTersimpan };
}

export async function pindahDana(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const jumlah = angkaIsian(teks(form, "jumlah"));
  if (!jumlah || jumlah <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_kas", { p_dari: teks(form, "dari"), p_ke: teks(form, "ke"), p_jumlah: jumlah, p_tanggal: teks(form, "tanggal") || null,
    p_keterangan: teks(form, "keterangan") || null, p_kunci: teks(form, "kunci") || randomUUID() });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.pindahTercatat };
}

export async function catatUang(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const jumlah = angkaIsian(teks(form, "jumlah"));
  if (!jumlah || jumlah <= 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_kas", { p_rekening: teks(form, "rekening"), p_arah: teks(form, "arah"), p_jumlah: jumlah, p_akun: teks(form, "akun"),
    p_tanggal: teks(form, "tanggal") || null, p_keterangan: teks(form, "keterangan"), p_kunci: teks(form, "kunci") || randomUUID() });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.uangTercatat };
}

/** CSV mutasi dari internet banking: diurai di server, baris yang sama tidak masuk dua kali. */
export async function imporMutasi(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const berkas = form.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) return { galat: k.pilihBerkas };
  if (berkas.size > 900_000) return { galat: k.berkasBesar };
  const urai = uraiMutasiCsv(await berkas.text());
  if ("galat" in urai) return { galat: k.csvRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("impor_mutasi", { p_rekening: teks(form, "rekening"), p_baris: urai.baris });
  if (error) return galat(k, error);
  segar();
  const d = data as { masuk: number; ganda: number };
  return { pesan: isiTeks(k.imporHasil, { masuk: d.masuk, ganda: d.ganda }) };
}

/** Satu pencocokan: nilai "jenis|target" dari pilihan baris (usulan, kandidat, akun lawan, atau abaikan). */
export async function cocokkanMutasi(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const [jenis, ...sisa] = teks(form, "pilihan").split("|");
  if (!jenis) return { galat: k.pilihCocok };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rekonsiliasi", { p_mutasi: teks(form, "mutasi"), p_jenis: jenis, p_target: sisa.join("|") || null, p_alasan: teks(form, "alasan") || null });
  if (error) return galat(k, error);
  segar();
  revalidatePath("/app/invoice");
  revalidatePath("/app/beli");
  return { pesan: k.cocokTercatat };
}

/** Jalankan semua usulan yang ditampilkan sekaligus; database memeriksa ulang setiap pencocokan (nilai, arah, status). */
export async function cocokkanSemua(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const butir = form.getAll("butir").map(String).map((s) => s.split("|"));
  const supabase = await createClient();
  let jadi = 0;
  for (const [mutasi, jenis, target, alasan] of butir) {
    const { error } = await supabase.rpc("rekonsiliasi", { p_mutasi: mutasi, p_jenis: jenis, p_target: target, p_alasan: alasan ?? null });
    if (error) { segar(); return { galat: isiTeks(k.sebagian, { jadi, pesan: error.code === "42501" ? k.hanya : error.message }) }; }
    jadi++;
  }
  segar();
  revalidatePath("/app/invoice");
  revalidatePath("/app/beli");
  return { pesan: isiTeks(k.semuaTercatat, { jadi }) };
}

export async function batalCocok(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_rekonsiliasi", { p_mutasi: teks(form, "mutasi"), p_alasan: teks(form, "alasan") });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.batalTercatat };
}

export async function simpanAturan(_: HasilKas, form: FormData): Promise<HasilKas> {
  const k = await teksKas();
  const supabase = await createClient();
  const arah = teks(form, "arah");
  const { error } = await supabase.rpc("simpan_aturan_rekon", { p_id: teks(form, "id") || null, p_kata: teks(form, "kata"), p_arah: arah === "CR" || arah === "DB" ? arah : null,
    p_akun: teks(form, "akun"), p_aktif: teks(form, "aktif") !== "tidak" });
  if (error) return galat(k, error);
  segar();
  return { pesan: k.aturanTersimpan };
}
