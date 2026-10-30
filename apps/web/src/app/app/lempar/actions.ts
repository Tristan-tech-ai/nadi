"use server";

import { bacaBerkas, type HasilLempar } from "@/lib/lempar";
import { createClient } from "@/lib/supabase/server";

/** Membaca berkas lewat server (sesi pengguna dari cookie): Edge Function tidak perlu dibuka untuk CORS browser. */
export async function bacaBerkasAksi(berkasId: string): Promise<HasilLempar> {
  if (!/^[0-9a-f-]{36}$/.test(berkasId)) return { status: "galat", pesan: "Berkas tidak dikenal." };
  return bacaBerkas(await createClient(), berkasId);
}
