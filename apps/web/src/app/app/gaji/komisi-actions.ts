"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilKomisi = { pesan: string } | { galat: string } | null;

export async function simpanAturanKomisi(_: HasilKomisi, form: FormData): Promise<HasilKomisi> {
  const k = ambilKamus(await bahasaAplikasi()).komisiPesan;
  const persen = Number(String(form.get("persen") ?? "0").replace(",", ".") || 0);
  const nominal = Number(String(form.get("nominal") ?? "0").replace(/[.\s]/g, "") || 0);
  if (!Number.isFinite(persen) || persen < 0 || persen > 100 || !Number.isInteger(nominal) || nominal < 0) return { galat: k.angkaRusak };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_commission_rule", { p_produk: String(form.get("produk") ?? "") || null, p_persen: persen, p_nominal: nominal });
  if (error) return { galat: ["22023", "P0002", "42501", "23514"].includes(error.code ?? "") ? isiTeks(k.galatDb, { pesan: error.message }) : k.gagal };
  revalidatePath("/app/gaji");
  return { pesan: k.tersimpan };
}
