"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-09: identitas pajak penjual dan pembeli untuk berkas impor Faktur Pajak Keluaran Coretax.
export type HasilFaktur = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).fakturPesan;
}
const galat = (k: Awaited<ReturnType<typeof teks>>, e: { code?: string; message: string }): HasilFaktur =>
  ({ galat: e.code === "42501" ? k.hanya : e.code === "22023" ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });

export async function simpanIdentitas(_: HasilFaktur, form: FormData): Promise<HasilFaktur> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_identitas_pajak", {
    p_npwp: String(form.get("npwp") ?? ""), p_nitku: String(form.get("nitku") ?? ""), p_pkp: true,
    p_termasuk: String(form.get("termasuk") ?? "ya") === "ya", p_kode: String(form.get("kode") ?? "04"),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/pajak/faktur");
  return { pesan: k.identitasTersimpan };
}

export async function simpanPembeli(_: HasilFaktur, form: FormData): Promise<HasilFaktur> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_pembeli_pajak", {
    p_nama: String(form.get("nama") ?? ""), p_jenis: String(form.get("jenis") ?? "TIN"), p_nomor: String(form.get("nomor") ?? ""),
    p_nitku: String(form.get("nitku") ?? ""), p_alamat: String(form.get("alamat") ?? ""), p_email: String(form.get("email") ?? ""),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/pajak/faktur");
  return { pesan: isiTeks(k.pembeliTersimpan, { nama: String(form.get("nama") ?? "") }) };
}

export async function potongPph(_: HasilFaktur, form: FormData): Promise<HasilFaktur> {
  const k = await teks();
  const dpp = Number(String(form.get("dpp") ?? "").replace(/\D/g, ""));
  if (!Number.isInteger(dpp) || dpp <= 0) return { galat: k.dppRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("potong_pph_tagihan", {
    p_tagihan: String(form.get("tagihan") ?? ""), p_kode: String(form.get("kode") ?? "").trim(), p_dpp: dpp,
    p_npwp: String(form.get("npwp") ?? ""), p_nitku: String(form.get("nitku") ?? ""), p_dokumen: String(form.get("dokumen") ?? "CommercialInvoice"),
    p_nomor: String(form.get("nomor") ?? ""), p_tgl_dokumen: String(form.get("tanggal") ?? "") || null, p_tgl_potong: null,
    p_kunci: String(form.get("kunci") ?? ""),
  });
  if (error) return galat(k, error);
  revalidatePath("/app/pajak/faktur");
  return { pesan: isiTeks(k.dipotong, { pph: new Intl.NumberFormat("id-ID").format((data as { pph: number }).pph) }) };
}
