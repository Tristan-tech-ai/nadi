"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cocokkan, uraiMutasiCsv, type InvoiceTerbuka } from "@/lib/invoice/cocok";
import { uraiQris } from "@/lib/invoice/qris";
import { angkaWa } from "@/lib/rekrut/keputusan";
import { createClient } from "@/lib/supabase/server";

export type HasilInvoice = { pesan: string; kode?: string } | { galat: string; isian?: Record<string, string> } | null;

const GALAT = (kode: string | undefined, pesan: string, cadangan: string) =>
  kode === "22023" || kode === "P0002" ? pesan : kode === "42501" ? "Hanya pemilik, admin, atau akuntan yang mengurus invoice." : cadangan;

/** Simpan QRIS statis (isi QR dibaca di peramban) dan rekening transfer. QR diperiksa ulang di server; isinya tidak diubah. */
export async function aturBayar(_: HasilInvoice, form: FormData): Promise<HasilInvoice> {
  const qris = String(form.get("qris") ?? "").trim();
  const rekening = String(form.get("rekening") ?? "").trim().slice(0, 200);
  let nama: string | null = null;
  let nmid: string | null = null;
  if (qris) {
    const h = uraiQris(qris);
    if (!h.ok) return { galat: h.galat };
    nama = h.nama.slice(0, 25);
    nmid = h.nmid;
  }
  if (!qris && !rekening) return { galat: "Isi QRIS atau rekening transfer, salah satu cukup." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_bayar", { p_qris: qris || null, p_qris_nama: nama, p_qris_nmid: nmid, p_rekening: rekening || null });
  if (error) return { galat: error.code === "42501" ? "Hanya pemilik yang mengatur tujuan bayar." : "Belum tersimpan. Coba lagi sebentar." };
  revalidatePath("/app/invoice");
  return { pesan: nama ? `Tersimpan. QRIS atas nama ${nama} tampil di setiap invoice.` : "Tersimpan." };
}

/** "1,5" -> 1.5; "25.000" (harga) -> 25000. */
const angkaJumlah = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
const angkaHarga = (s: string) => Number(s.replace(/[^\d]/g, ""));

export async function buatInvoice(_: HasilInvoice, form: FormData): Promise<HasilInvoice> {
  const isian: Record<string, string> = {
    pelanggan: String(form.get("pelanggan") ?? "").trim(), hp: String(form.get("hp") ?? "").trim(),
    jatuh_tempo: String(form.get("jatuh_tempo") ?? ""), catatan: String(form.get("catatan") ?? "").trim(),
    kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  const uraian = form.getAll("uraian").map(String);
  const jumlah = form.getAll("jumlah").map(String);
  const harga = form.getAll("harga").map(String);
  uraian.forEach((u, i) => { isian[`uraian.${i}`] = u; isian[`jumlah.${i}`] = jumlah[i] ?? ""; isian[`harga.${i}`] = harga[i] ?? ""; });
  isian.n = String(uraian.length);
  const baris = uraian
    .map((u, i) => ({ uraian: u.trim(), jumlah: angkaJumlah(jumlah[i] ?? ""), harga: angkaHarga(harga[i] ?? "") }))
    .filter((b) => b.uraian || b.harga);
  if (!isian.pelanggan) return { galat: "Tulis nama pelanggan.", isian };
  if (baris.length === 0) return { galat: "Isi minimal satu baris barang atau jasa.", isian };
  if (baris.some((b) => !b.uraian || !Number.isFinite(b.jumlah) || b.jumlah <= 0 || !Number.isFinite(b.harga))) {
    return { galat: "Setiap baris butuh uraian, jumlah lebih dari 0, dan harga.", isian };
  }
  let hp: string | null = null;
  if (isian.hp) {
    hp = angkaWa(isian.hp);
    if (!hp) return { galat: "Nomor WhatsApp pelanggan belum benar. Contoh: 0812 3456 7890.", isian };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isian.jatuh_tempo)) return { galat: "Pilih tanggal jatuh tempo.", isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_invoice", {
    p_pelanggan: isian.pelanggan, p_hp: hp, p_baris: baris, p_jatuh_tempo: isian.jatuh_tempo, p_catatan: isian.catatan || null, p_kunci: isian.kunci,
  });
  if (error) return { galat: GALAT(error.code, error.message, "Invoice belum terbit. Coba lagi; isianmu masih ada."), isian: { ...isian, kunci: randomUUID() } };
  revalidatePath("/app/invoice");
  const d = data as { nomor: string; kode: string };
  return { pesan: `Terbit: ${d.nomor}. Bagikan tautannya ke pelanggan dari daftar di bawah.`, kode: d.kode };
}

export async function tandaiLunas(_: HasilInvoice, form: FormData): Promise<HasilInvoice> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_lunas", {
    p_id: String(form.get("invoice") ?? ""), p_cara: String(form.get("cara") ?? ""), p_tanggal: String(form.get("tanggal") ?? "") || null,
  });
  if (error) return { galat: GALAT(error.code, error.message, "Belum tercatat lunas. Coba lagi sebentar.") };
  revalidatePath("/app/invoice");
  return { pesan: "Tercatat lunas. Pengingat berikutnya tidak akan muncul." };
}

export async function batalkanInvoice(_: HasilInvoice, form: FormData): Promise<HasilInvoice> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_invoice", { p_id: String(form.get("invoice") ?? ""), p_alasan: String(form.get("alasan") ?? "") });
  if (error) return { galat: GALAT(error.code, error.message, "Invoice belum dibatalkan. Coba lagi sebentar.") };
  revalidatePath("/app/invoice");
  return { pesan: "Invoice dibatalkan; jurnalnya sudah dibalik." };
}

/** Dipanggil saat pemilik membuka tautan wa.me pengingat: tandai terkirim (pesannya dikirim pemilik sendiri). */
export async function catatPengingat(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("catat_pengingat", { p_id: id });
  revalidatePath("/app/invoice");
}

export type BarisCocok = { invoice: string; nomor: string; pelanggan: string; total: number; tanggal: string; keterangan: string; jumlah: number; alasan: string };
export type BarisRagu = { tanggal: string; keterangan: string; jumlah: number; kandidat: { id: string; nomor: string; pelanggan: string }[] };
export type HasilCocok = { cocok: BarisCocok[]; ragu: BarisRagu[]; kredit: number } | { selesai: string; gagal: string[] } | { galat: string } | null;

/** F4-06: cocokkan CSV mutasi (dibaca di peramban) dengan invoice terbit. Belum melunasi apa pun. */
export async function cocokkanMutasi(_: HasilCocok, form: FormData): Promise<HasilCocok> {
  const teks = String(form.get("csv") ?? "");
  if (!teks.trim()) return { galat: "Pilih berkas CSV mutasi dulu." };
  if (teks.length > 2_000_000) return { galat: "Berkas terlalu besar. Unduh mutasi per bulan saja." };
  const r = uraiMutasiCsv(teks);
  if ("galat" in r) return { galat: r.galat };
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoice").select("id, nomor, pelanggan, total, tanggal, jatuh_tempo").eq("status", "terbit").limit(1000);
  if (error) return { galat: "Daftar invoice belum bisa dibaca. Coba lagi sebentar." };
  const inv = (data ?? []).map((v) => ({ ...v, total: Number(v.total) })) as InvoiceTerbuka[];
  const per = new Map(inv.map((v) => [v.id, v]));
  const h = cocokkan(r.baris, inv);
  const cocok: BarisCocok[] = [];
  const ragu: BarisRagu[] = [];
  for (const x of h) {
    const m = r.baris[x.indeks];
    if (x.invoice) {
      const v = per.get(x.invoice)!;
      cocok.push({ invoice: v.id, nomor: v.nomor, pelanggan: v.pelanggan, total: v.total, tanggal: m.tanggal, keterangan: m.keterangan, jumlah: m.jumlah, alasan: x.alasan! });
    } else if (x.kandidat.length > 0) {
      ragu.push({ tanggal: m.tanggal, keterangan: m.keterangan, jumlah: m.jumlah, kandidat: x.kandidat.map((id) => ({ id, nomor: per.get(id)!.nomor, pelanggan: per.get(id)!.pelanggan })) });
    }
  }
  return { cocok, ragu, kredit: r.baris.filter((b) => b.arah === "CR").length };
}

/** Lunasi semua yang cocok (cara transfer, tanggal mutasi) lewat tandai_lunas; yang ditolak dilaporkan. */
export async function lunasDariMutasi(_: HasilCocok, form: FormData): Promise<HasilCocok> {
  let daftar: { invoice: string; nomor: string; tanggal: string }[];
  try {
    daftar = JSON.parse(String(form.get("daftar") ?? "[]"));
  } catch {
    return { galat: "Daftar rusak. Cocokkan ulang." };
  }
  if (!Array.isArray(daftar) || daftar.length === 0 || daftar.length > 500) return { galat: "Tidak ada yang dilunasi." };
  const supabase = await createClient();
  let n = 0;
  const gagal: string[] = [];
  for (const d of daftar) {
    const { error } = await supabase.rpc("tandai_lunas", { p_id: String(d.invoice), p_cara: "transfer", p_tanggal: String(d.tanggal) });
    if (error) gagal.push(`${d.nomor}: ${error.code === "22023" || error.code === "P0002" ? error.message : "belum tercatat"}`);
    else n++;
  }
  revalidatePath("/app/invoice");
  return { selesai: `${n} invoice tercatat lunas lewat transfer.`, gagal };
}
