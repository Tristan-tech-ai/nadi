"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilSerah = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const ALASAN = ["mundur", "kontrak_selesai", "lainnya"];
const tanggal = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Pesan serah terima dalam bahasa pengguna; pesan database (bahasa Indonesia) dibungkus di bahasa lain. */
async function teksSerah() {
  const t = ambilKamus(await bahasaAplikasi()).serahPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}

/** Catat orang berhenti; database menyusun paket serah terima dalam satu transaksi (F3-07). */
export async function catatBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const isian = {
    orang: String(form.get("orang") ?? ""), surat: String(form.get("surat") ?? ""), efektif: String(form.get("efektif") ?? ""),
    alasan: String(form.get("alasan") ?? ""), kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  if (!isian.orang) return { galat: k.pilihOrang, isian };
  if (!tanggal(isian.surat) || !tanggal(isian.efektif)) return { galat: k.isiTanggal, isian };
  if (isian.efektif < isian.surat) return { galat: k.efektifSebelum, isian };
  if (!ALASAN.includes(isian.alasan)) return { galat: k.pilihAlasan, isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catat_berhenti", { p_orang: isian.orang, p_surat: isian.surat, p_efektif: isian.efektif, p_alasan: isian.alasan, p_kunci: isian.kunci });
  if (error) return { galat: error.code === "42501" ? k.hanyaCatat : error.code === "22023" || error.code === "P0002" ? k.db(error.message) : k.gagalPaket, isian };
  revalidatePath("/app/serah-terima");
  const kurang = ((data as { peringatan: string[] }).peringatan ?? []).includes("kurang_30_hari");
  return { pesan: kurang ? k.disiapkanKurang : k.disiapkan };
}

export async function pindahkanSemua(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pindahkan_ke_pengganti", { p_berhenti: String(form.get("berhenti") ?? "") });
  if (error) return { galat: error.code === "42501" ? k.hanyaPindah : k.gagalPindah };
  revalidatePath("/app/serah-terima");
  return { pesan: data ? isiTeks(k.dipindah, { n: Number(data) }) : k.tanpaPindah };
}

export async function tandaiButir(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const status = String(form.get("status") ?? "");
  const pengganti = String(form.get("pengganti") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_butir", { p_butir: String(form.get("butir") ?? ""), p_status: status, p_pengganti: pengganti || null });
  if (error) return { galat: error.code === "22023" ? k.db(error.message) : k.gagalButir };
  revalidatePath("/app/serah-terima");
  return { pesan: k.tersimpan };
}

export async function batalkanBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const alasan = String(form.get("alasan") ?? "").trim();
  if (alasan.length < 3) return { galat: k.tulisAlasan };
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_berhenti", { p_berhenti: String(form.get("berhenti") ?? ""), p_alasan: alasan });
  if (error) return { galat: k.gagalBatal };
  revalidatePath("/app/serah-terima");
  return { pesan: k.dibatalkan };
}
