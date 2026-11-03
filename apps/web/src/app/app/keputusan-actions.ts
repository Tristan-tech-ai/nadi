"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilBatal = { pesan: string } | { galat: string } | null;

/** Batalkan satu keputusan otomatis; database membalik akibatnya (izin kembali menunggu dan masuk Feed, rute kembali ke admin). */
export async function batalkanKeputusan(_: HasilBatal, form: FormData): Promise<HasilBatal> {
  const supabase = await createClient();
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).keputusanOto;
  const { data, error } = await supabase.rpc("batalkan_keputusan", { p_id: String(form.get("id") ?? ""), p_alasan: String(form.get("alasan") ?? "") });
  if (error) return { galat: ["22023", "55000", "P0002", "42501"].includes(error.code ?? "") ? (bahasa === "id" ? error.message : isiTeks(t.galatDb, { pesan: error.message })) : t.gagal };
  revalidatePath("/app/perusahaan");
  revalidatePath("/app");
  return { pesan: (data as { usulan: string | null }).usulan ? t.kembaliFeed : t.batalSaja };
}
