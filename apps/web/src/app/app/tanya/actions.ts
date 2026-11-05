"use server";

import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { uraiTanya, type Niat } from "@/lib/tanya/urai";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export type Jawaban = { niat: Niat; nilai: number | null; jumlah: number | null; satuan: string; dari: string; sampai: string; sumber: string;
  rincian: { nama: string; kode: string; satuan: string; jumlah: number }[] | null };
export type HasilTanya = { tanya: string; jawaban: Jawaban } | { tanya: string; tidakBisa: true } | { tanya: string; galat: string } | null;

export async function tanyaData(_: HasilTanya, form: FormData): Promise<HasilTanya> {
  const sesi = await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi(sesi.bahasa)).tanyaPesan;
  const tanya = String(form.get("tanya") ?? "").trim().slice(0, 200);
  if (tanya.length < 3) return { tanya, galat: k.kosong };
  const t = uraiTanya(tanya, hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId)));
  if (!t) return { tanya, tidakBisa: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ask_data", { p_niat: t.niat, p_dari: t.dari, p_sampai: t.sampai, p_cari: t.cari ?? null });
  if (error) return { tanya, galat: ["22023", "42501"].includes(error.code ?? "") ? isiTeks(k.galatDb, { pesan: error.message }) : k.gagal };
  return { tanya, jawaban: data as Jawaban };
}
