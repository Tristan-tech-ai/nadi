"use server";

import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { bacaBerkas, type HasilLempar } from "@/lib/lempar";
import { createClient } from "@/lib/supabase/server";

/** Membaca berkas lewat server (sesi pengguna dari cookie): Edge Function tidak perlu dibuka untuk CORS browser. */
export async function bacaBerkasAksi(berkasId: string): Promise<HasilLempar> {
  const t = ambilKamus(await bahasaAplikasi()).lemparPesan;
  if (!/^[0-9a-f-]{36}$/.test(berkasId)) return { status: "galat", pesan: t.tidakDikenal };
  return bacaBerkas(await createClient(), berkasId, t);
}
