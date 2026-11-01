"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
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
