"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-06: aset tetap. Semua hitungan dan jurnal di database (Pasal 11 UU PPh); aksi ini meneruskan isian.
export type HasilAset = { pesan: string } | { galat: string } | null;
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tgl = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t(f, k)) ? t(f, k) : null);
const rp = (f: FormData, k: string) => Number(t(f, k).replace(/[^\d]/g, "") || 0);

async function salah(e: { code?: string; message: string }): Promise<HasilAset> {
  const k = ambilKamus(await bahasaAplikasi()).asetPesan;
  return { galat: e.code === "42501" ? k.hanya : ["22023", "P0002"].includes(e.code ?? "") ? e.message : k.gagal };
}

export async function catatAset(_: HasilAset, f: FormData): Promise<HasilAset> {
  const k = ambilKamus(await bahasaAplikasi()).asetPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("catat_aset", { p_nama: t(f, "nama"), p_kelompok: t(f, "kelompok"), p_metode: t(f, "metode"), p_tanggal: tgl(f, "tanggal"), p_harga: rp(f, "harga"), p_cara: t(f, "cara") });
  if (error) return salah(error);
  revalidatePath("/app/aset");
  return { pesan: k.tercatat };
}

export async function jalankanPenyusutan(_: HasilAset, f: FormData): Promise<HasilAset> {
  const k = ambilKamus(await bahasaAplikasi()).asetPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("jalankan_penyusutan", { p_sampai: tgl(f, "sampai") });
  if (error) return salah(error);
  const d = data as { bulan: number; dilewati: number };
  revalidatePath("/app/aset");
  return { pesan: isiTeks(d.dilewati ? k.disusutkanLewat : k.disusutkan, { n: d.bulan, m: d.dilewati }) };
}

export async function lepasAset(_: HasilAset, f: FormData): Promise<HasilAset> {
  const k = ambilKamus(await bahasaAplikasi()).asetPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lepas_aset", { p_aset: t(f, "aset"), p_tanggal: tgl(f, "tanggal"), p_harga_jual: rp(f, "harga_jual"), p_cara: t(f, "cara") || "kas" });
  if (error) return salah(error);
  const d = data as { laba: number };
  revalidatePath("/app/aset");
  return { pesan: isiTeks(d.laba >= 0 ? k.dijualLaba : k.dijualRugi, { n: Math.abs(d.laba).toLocaleString("id-ID") }) };
}

export async function pinjamkanAset(_: HasilAset, f: FormData): Promise<HasilAset> {
  const k = ambilKamus(await bahasaAplikasi()).asetPesan;
  const supabase = await createClient();
  const orang = t(f, "orang");
  const { error } = await supabase.rpc("pinjamkan_aset", { p_aset: t(f, "aset"), p_orang: orang || null, p_catatan: t(f, "catatan") });
  if (error) return salah(error);
  revalidatePath("/app/aset");
  return { pesan: orang ? k.dipinjamkan : k.dikembalikan };
}
