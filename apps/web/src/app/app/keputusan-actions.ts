"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilBatal = { pesan: string } | { galat: string } | null;

/** Batalkan satu keputusan otomatis; database membalik akibatnya (izin kembali menunggu dan masuk Feed, rute kembali ke admin). */
export async function batalkanKeputusan(_: HasilBatal, form: FormData): Promise<HasilBatal> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("batalkan_keputusan", { p_id: String(form.get("id") ?? ""), p_alasan: String(form.get("alasan") ?? "") });
  if (error) return { galat: ["22023", "55000", "P0002", "42501"].includes(error.code ?? "") ? error.message : "Gagal membatalkan. Coba lagi sebentar." };
  revalidatePath("/app/perusahaan");
  revalidatePath("/app");
  return { pesan: (data as { usulan: string | null }).usulan ? "Dibatalkan. Pengajuannya kini menunggu keputusanmu di Feed." : "Dibatalkan." };
}
