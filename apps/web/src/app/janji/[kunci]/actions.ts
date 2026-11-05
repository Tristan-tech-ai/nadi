"use server";

import { createClient } from "@/lib/supabase/server";

// M-16B: pemesanan janji temu tanpa akun lewat kunci acak halaman /janji/<kunci>.
export async function slotJanji(kunci: string, layanan: string, tanggal: string): Promise<string[] | { galat: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !/^[0-9a-f-]{36}$/i.test(layanan)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_slots", { p_kunci: kunci, p_layanan: layanan, p_tanggal: tanggal });
  return error ? { galat: error.message } : ((data ?? []) as string[]);
}

export async function pesanJanji(kunci: string, f: FormData): Promise<{ kode: string; layanan: string; tanggal: string; jam: string } | { galat: string }> {
  const t = (k: string) => String(f.get(k) ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_kunci: kunci, p_layanan: t("layanan"), p_tanggal: t("tanggal"), p_jam: t("jam"), p_nama: t("nama"), p_hp: t("hp") || null, p_catatan: t("catatan") || null,
  });
  if (error) return { galat: error.message };
  return data as { kode: string; layanan: string; tanggal: string; jam: string };
}
