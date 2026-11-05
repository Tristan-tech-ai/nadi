"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { barisDariButir, type BarisDraf } from "@/lib/onboarding/draf";
import { hariIni } from "@/lib/izin";
import { uraiTeksNadi } from "@/lib/onboarding/teks-nadi";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

// U-04: draf AI. Teks Nadi yang ditempel atau berkas .txt/.md diurai ulang di server lalu menjadi SATU draf (RPC save_ai_draft),
// bukan usulan per baris. Ubah sel, hapus, tambah, centang, terapkan, dan batal lewat RPC yang memeriksa peran dan usaha.
export type HasilDraf = { galat: string } | null;

const pesanGalat = (code?: string, msg?: string) =>
  code === "42501" ? "Khusus pemilik atau admin." : code === "22023" && msg ? msg : code === "P0429" ? "Batas draf hari ini tercapai. Coba lagi besok." : "Nadi gagal menyimpan. Coba lagi sebentar.";

export async function jadikanDraf(_: HasilDraf, form: FormData): Promise<HasilDraf> {
  const sesi = await wajibPerusahaan();
  const teks = String(form.get("teks") ?? "");
  if (teks.length > 20000) return { galat: "Teks terlalu panjang (maksimal 20.000 huruf). Pecah menjadi beberapa bagian." };
  const h = uraiTeksNadi(teks, hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId)));
  if (h.galat === "tanpa_kepala") return { galat: "Baris pertama harus NADI ONBOARDING 1. Minta AI-mu memakai prompt Nadi." };
  if (h.galat === "json") return { galat: "JSON-nya rusak. Minta AI-mu menulis ulang dalam format teks." };
  const baris = barisDariButir(h.butir, "Teks Nadi yang ditempel");
  if (!baris.length) return { galat: "Belum ada baris yang dikenali. Periksa pratinjau di atas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_ai_draft", { p_baris: baris });
  if (error) return { galat: pesanGalat(error.code, error.message) };
  redirect(`/app/siapkan/draf/${data as string}`);
}

async function ubah(draf: string, ops: unknown[]): Promise<{ baris?: BarisDraf[]; galat?: string }> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edit_ai_draft", { p_draf: draf, p_ops: ops });
  if (error) return { galat: pesanGalat(error.code, error.message) };
  return { baris: data as BarisDraf[] };
}

export async function ubahSel(draf: string, id: string, nilai: Record<string, unknown>) { return ubah(draf, [{ op: "ubah", id, nilai }]); }
export async function hapusBaris(draf: string, id: string) { return ubah(draf, [{ op: "hapus", id }]); }
export async function tambahBaris(draf: string, bagian: string, nilai: Record<string, unknown>) { return ubah(draf, [{ op: "tambah", baris: { bagian, nilai, alasan: "Ditambah pemilik" } }]); }
export async function centangBaris(draf: string, id: string, centang: boolean) { return ubah(draf, [{ op: "centang", id, centang }]); }

export async function terapkanDraf(draf: string): Promise<{ diterapkan?: number; batalSampai?: string; galat?: string }> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_ai_draft", { p_draf: draf });
  if (error) return { galat: pesanGalat(error.code, error.message) };
  revalidatePath("/app", "layout");
  const d = data as { diterapkan: number; batal_sampai: string };
  return { diterapkan: d.diterapkan, batalSampai: d.batal_sampai };
}

export async function batalkanDraf(draf: string): Promise<{ ok?: boolean; galat?: string }> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_ai_draft", { p_draf: draf });
  if (error) return { galat: pesanGalat(error.code, error.message) };
  revalidatePath("/app", "layout");
  return { ok: true };
}
