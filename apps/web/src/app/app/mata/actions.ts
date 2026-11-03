"use server";

import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import type { Zona } from "@/lib/mata/resep";

export type ZonaTersimpan = Zona;
export type HasilZona = { zona: ZonaTersimpan[] } | { galat: string };

async function galatDb(e: { code?: string; message: string }): Promise<string> {
  const k = ambilKamus(await bahasaAplikasi()).mataPesan;
  if (e.code === "42501") return k.hanya;
  if (e.code === "22023" || e.code === "P0002") return isiTeks(k.galatDb, { pesan: e.message });
  return k.gagal;
}

/** Simpan seluruh daftar zona (zona yang tidak ada di daftar dinonaktifkan database, tidak dihapus). */
export async function simpanZona(zona: { id?: string; nama: string; jenis: string; poligon: [number, number][] }[]): Promise<HasilZona> {
  await wajibPerusahaan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simpan_zona_mata", { p_zona: zona });
  if (error) return { galat: await galatDb(error) };
  return { zona: data as ZonaTersimpan[] };
}

/** Catat perubahan status zona; database membuang yang tidak berubah. Tidak ada gambar yang ikut. */
export async function catatMata(butir: { zona: string; status?: "kosong" | "terisi"; jumlah?: number }[]): Promise<{ dicatat: number } | { galat: string }> {
  await wajibPerusahaan();
  if (!butir.length) return { dicatat: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catat_mata", { p_butir: butir.slice(0, 50) });
  if (error) return { galat: await galatDb(error) };
  return { dicatat: Number(data) || 0 };
}
