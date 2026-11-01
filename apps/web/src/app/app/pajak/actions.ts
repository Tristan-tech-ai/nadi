"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilPajak = { pesan: string } | { galat: string } | null;

const RUPIAH = ["bruto_lalu", "usaha_lain_lalu", "usaha_lain_ini", "pasangan_lalu", "pasangan_ini"] as const;

/** Profil pajak usaha (F4-07): bentuk dan bruto pembanding untuk batas Rp4,8 M gabungan. Hanya pemilik. */
export async function aturProfilPajak(_: HasilPajak, form: FormData): Promise<HasilPajak> {
  const bentuk = String(form.get("bentuk") ?? "");
  const profil: Record<string, string | number> = { bentuk };
  for (const k of RUPIAH) {
    const s = String(form.get(k) ?? "").replace(/[^\d]/g, "");
    if (s) profil[k] = Number(s);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_profil_pajak", { p_profil: profil });
  if (error) return { galat: error.code === "22023" ? error.message : error.code === "42501" ? "Hanya pemilik yang mengatur profil pajak." : "Belum tersimpan. Coba lagi sebentar." };
  revalidatePath("/app/pajak");
  return { pesan: "Tersimpan." };
}
