import { cache } from "react";
import { zonaSah } from "@/lib/izin";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** Zona waktu usaha aktif (perusahaan.zona_waktu, dibaca lewat RLS). Dipakai agar "hari ini" di aksi sama dengan app.hari_ini di database. */
export async function zonaUsaha(supabase: Awaited<ReturnType<typeof createClient>>, perusahaanId: string): Promise<string> {
  const { data } = await supabase.from("perusahaan").select("zona_waktu").eq("id", perusahaanId).maybeSingle();
  return zonaSah(data?.zona_waktu);
}

/** zonaUsaha sekali per permintaan walau dipanggil beberapa komponen (React cache, tidak dibagi antar permintaan). */
export const zonaUsahaIni = cache(async (perusahaanId: string): Promise<string> => zonaUsaha(await createClient(), perusahaanId));

/** Zona usaha aktif dari sesi, untuk komponen yang tidak menerima sesi. Tanpa usaha aktif: bawaan kolom (Asia/Jakarta). Hanya di balik Suspense. */
export async function zonaSesi(): Promise<string> {
  const sesi = await bacaSesi();
  return sesi?.perusahaanId ? zonaUsahaIni(sesi.perusahaanId) : zonaSah(null);
}
