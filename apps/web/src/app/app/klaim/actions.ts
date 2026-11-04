"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-18: klaim pengeluaran dan perjalanan dinas. Database memeriksa batas, struk, tanggal, dan peran; aksi ini hanya meneruskan.
export type HasilKlaim = { pesan: string } | { galat: string } | null;
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tgl = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t(f, k)) ? t(f, k) : null);
const rupiah = (f: FormData, k: string) => Number(t(f, k).replace(/[^\d]/g, "") || 0);
const uuid = (f: FormData, k: string) => (/^[0-9a-f-]{36}$/i.test(t(f, k)) ? t(f, k) : null);

async function salah(e: { code?: string; message: string }): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  return { galat: e.code === "42501" ? (e.message.includes("terhubung") ? e.message : k.hanya) : ["22023", "P0002", "23505"].includes(e.code ?? "") ? e.message : k.gagal };
}
const segarkan = () => { revalidatePath("/app/klaim"); revalidatePath("/app"); };

export async function ajukanKlaim(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajukan_klaim", {
    p_kategori: uuid(f, "kategori"), p_tanggal: tgl(f, "tanggal"), p_jumlah: rupiah(f, "jumlah"), p_keterangan: t(f, "keterangan"),
    p_berkas: uuid(f, "berkas"), p_perjalanan: uuid(f, "perjalanan"), p_kunci: uuid(f, "kunci"),
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.diajukan };
}

export async function ajukanDinas(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajukan_dinas", {
    p_tujuan: t(f, "tujuan"), p_mulai: tgl(f, "mulai"), p_selesai: tgl(f, "selesai"), p_keperluan: t(f, "keperluan"), p_uang_muka: rupiah(f, "uang_muka"), p_kunci: uuid(f, "kunci"),
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.dinasDiajukan };
}

export async function simpanKategori(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const batas = rupiah(f, "batas");
  const { error } = await supabase.rpc("simpan_kategori_klaim", {
    p_id: null, p_nama: t(f, "nama"), p_batas: batas > 0 ? batas : null, p_akun: t(f, "akun"), p_butuh_struk: f.get("butuh_struk") === "on", p_aktif: true,
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.kategoriTersimpan };
}

export async function bayarKlaim(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bayar_klaim", { p_klaim: uuid(f, "klaim"), p_cara: t(f, "cara") });
  if (error) return salah(error);
  segarkan();
  return { pesan: isiTeks(k.dibayar, { n: Number((data as { dibayar: number }).dibayar).toLocaleString("id-ID") }) };
}

export async function bayarUangMuka(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const { error } = await supabase.rpc("bayar_uang_muka_dinas", { p_dinas: uuid(f, "dinas"), p_cara: t(f, "cara") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.uangMukaDibayar };
}

export async function selesaikanDinas(_: HasilKlaim, f: FormData): Promise<HasilKlaim> {
  const k = ambilKamus(await bahasaAplikasi()).klaimPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("selesaikan_dinas", { p_dinas: uuid(f, "dinas") });
  if (error) return salah(error);
  const d = data as { dipotong: number; kasbon: number; sisa_klaim: number };
  segarkan();
  return { pesan: isiTeks(k.dinasSelesai, { potong: d.dipotong.toLocaleString("id-ID"), kasbon: d.kasbon.toLocaleString("id-ID"), sisa: Number(d.sisa_klaim).toLocaleString("id-ID") }) };
}
