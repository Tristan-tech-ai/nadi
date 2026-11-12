"use server";

import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { aturanCocok, bentukTanya, ditolak, uraiTanya, uraiTanyaBanyak, type AturanTanya, type Niat } from "@/lib/tanya/urai";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export type Jawaban = { niat: Niat; nilai: number | null; jumlah: number | null; satuan: string; dari: string; sampai: string; sumber: string;
  rincian: { nama: string; kode: string; satuan: string; jumlah: number }[] | null };
/** Asal niat: pengurai bawaan, aturan yang sudah dipelajari (token 0), atau model lewat pelajari-tanya (T-01A). */
export type AsalNiat = { asal: "bawaan" | "aturan" | "model"; token: number };
export type HasilTanya = { tanya: string; jawaban: Jawaban; lainnya?: Jawaban[]; niat: AsalNiat } | { tanya: string; tidakBisa: true } | { tanya: string; galat: string } | null;

export async function tanyaData(_: HasilTanya, form: FormData): Promise<HasilTanya> {
  const sesi = await wajibPerusahaan();
  const k = ambilKamus(await bahasaAplikasi(sesi.bahasa)).tanyaPesan;
  const tanya = String(form.get("tanya") ?? "").trim().slice(0, 200);
  if (tanya.length < 3) return { tanya, galat: k.kosong };
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const supabase = await createClient();
  // T-01A: aturan hasil belajar usaha ini (dan aturan bersama). Yang aktif dipakai tanpa model; yang bayangan masih dibandingkan.
  const { data: aturan } = await supabase.from("tanya_aturan").select("id, kata, niat, status").in("status", ["aktif", "bayangan"]);
  const semua = (aturan ?? []) as (AturanTanya & { status: string })[];
  // M-22B: pertanyaan gabungan ("penjualan dan laba bulan ini") dijawab satu per satu dengan periode yang sama, tanpa model.
  const banyak = uraiTanyaBanyak(tanya, hari, semua.filter((a) => a.status === "aktif"));
  if (banyak.length >= 2) {
    const hasil = await Promise.all(banyak.map((x) => supabase.rpc("ask_data", { p_niat: x.niat, p_dari: x.dari, p_sampai: x.sampai, p_cari: x.cari ?? null })));
    const gagal = hasil.find((r) => r.error);
    if (gagal?.error) return { tanya, galat: ["22023", "42501"].includes(gagal.error.code ?? "") ? isiTeks(k.galatDb, { pesan: gagal.error.message }) : k.gagal };
    const [pertama, ...lain] = hasil.map((r) => r.data as Jawaban);
    return { tanya, jawaban: pertama, lainnya: lain, niat: { asal: "bawaan", token: 0 } };
  }
  let t = uraiTanya(tanya, hari, semua.filter((a) => a.status === "aktif"));
  const asal: AsalNiat = { asal: t?.aturan ? "aturan" : "bawaan", token: 0 };
  if (!t && !ditolak(tanya)) {
    const bayangan = aturanCocok(tanya, semua.filter((a) => a.status === "bayangan"));
    const { data: b } = await supabase.functions.invoke("pelajari-tanya", { body: { kalimat: tanya, hari_ini: hari, aturan_id: bayangan?.id } });
    const hasil = b as { niat: Niat | null; token?: number } | null;
    if (hasil?.niat) {
      t = bentukTanya(tanya, hari, hasil.niat);
      asal.asal = "model";
      asal.token = hasil.token ?? 0;
    }
  }
  if (!t) return { tanya, tidakBisa: true };
  const { data, error } = await supabase.rpc("ask_data", { p_niat: t.niat, p_dari: t.dari, p_sampai: t.sampai, p_cari: t.cari ?? null });
  if (error) return { tanya, galat: ["22023", "42501"].includes(error.code ?? "") ? isiTeks(k.galatDb, { pesan: error.message }) : k.gagal };
  return { tanya, jawaban: data as Jawaban, niat: asal };
}
