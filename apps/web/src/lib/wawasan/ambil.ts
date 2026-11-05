import type { SupabaseClient } from "@supabase/supabase-js";
import { BATAS_BARIS, SUMBER, type Pilihan } from "@/lib/wawasan/laporan";

/** Baris laporan untuk layar dan CSV: kolom dari daftar putih, saring ilike pada kolom cari sumber, dibaca lewat RLS. */
export async function ambilBaris(supabase: SupabaseClient, p: Pilihan, batas = BATAS_BARIS) {
  const s = SUMBER[p.sumber];
  let q = supabase.from(s.tabel).select(p.kolom.join(","));
  if (p.cari) q = q.ilike(s.cari, `%${p.cari}%`);
  const { data, error } = await q.order(s.urut, { ascending: s.urut === "nama" }).limit(batas);
  return { baris: (data ?? []) as unknown as Record<string, unknown>[], galat: error };
}
