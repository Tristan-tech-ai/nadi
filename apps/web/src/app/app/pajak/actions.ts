"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilPajak = { pesan: string } | { galat: string } | null;

const RUPIAH = ["bruto_lalu", "usaha_lain_lalu", "usaha_lain_ini", "pasangan_lalu", "pasangan_ini"] as const;

/** Profil pajak usaha (F4-07): bentuk dan bruto pembanding untuk batas Rp4,8 M gabungan. Hanya pemilik. */
export async function aturProfilPajak(_: HasilPajak, form: FormData): Promise<HasilPajak> {
  const k = ambilKamus(await bahasaAplikasi()).pajakPesan;
  const bentuk = String(form.get("bentuk") ?? "");
  const profil: Record<string, string | number> = { bentuk };
  for (const k of RUPIAH) {
    const s = String(form.get(k) ?? "").replace(/[^\d]/g, "");
    if (s) profil[k] = Number(s);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_profil_pajak", { p_profil: profil });
  if (error) return { galat: error.code === "22023" ? isiTeks(k.galatDb, { pesan: error.message }) : error.code === "42501" ? k.hanyaPemilik : k.belumTersimpan };
  revalidatePath("/app/pajak");
  return { pesan: k.tersimpan };
}
