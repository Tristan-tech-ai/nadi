import { zonaSah } from "@/lib/izin";
import type { createClient } from "@/lib/supabase/server";

/** Zona waktu usaha aktif (perusahaan.zona_waktu, dibaca lewat RLS). Dipakai agar "hari ini" di aksi sama dengan app.hari_ini di database. */
export async function zonaUsaha(supabase: Awaited<ReturnType<typeof createClient>>, perusahaanId: string): Promise<string> {
  const { data } = await supabase.from("perusahaan").select("zona_waktu").eq("id", perusahaanId).maybeSingle();
  return zonaSah(data?.zona_waktu);
}
