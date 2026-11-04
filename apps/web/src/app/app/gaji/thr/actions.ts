"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-10: THR diajukan sebagai satu usulan untuk pemilik (RPC ajukan_thr menghitung ulang di database).
export type HasilThr = { pesan: string } | { galat: string } | null;

export async function ajukanThr(_: HasilThr, form: FormData): Promise<HasilThr> {
  const k = ambilKamus(await bahasaAplikasi()).thrPesan;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ajukan_thr", { p_hari_raya: String(form.get("hari") ?? ""), p_kunci: String(form.get("kunci") ?? "") });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" ? error.message : k.gagal };
  revalidatePath("/app");
  return { pesan: isiTeks(k.diajukan, { n: (data as { orang?: number }).orang ?? 0 }) };
}
