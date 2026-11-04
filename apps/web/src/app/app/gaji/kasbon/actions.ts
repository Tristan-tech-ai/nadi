"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-10B: kasbon dari kas usaha sendiri (RPC beri_kasbon, hanya pemilik); cicilannya masuk slip saat gaji disiapkan.
export type HasilKasbon = { pesan: string } | { galat: string } | null;
const rupiah = (x: FormDataEntryValue | null) => Number(String(x ?? "").replace(/[^\d]/g, "") || 0);

export async function beriKasbon(_: HasilKasbon, form: FormData): Promise<HasilKasbon> {
  const k = ambilKamus(await bahasaAplikasi()).kasbonPesan;
  const jumlah = rupiah(form.get("jumlah"));
  const cicilan = rupiah(form.get("cicilan"));
  if (jumlah <= 0 || cicilan <= 0 || cicilan > jumlah) return { galat: k.isi };
  const supabase = await createClient();
  const { error } = await supabase.rpc("beri_kasbon", {
    p_orang: String(form.get("orang") ?? ""), p_jumlah: jumlah, p_cicilan: cicilan, p_cara: String(form.get("cara") ?? "tunai"),
    p_alasan: String(form.get("alasan") ?? ""), p_kunci: String(form.get("kunci") ?? ""),
  });
  if (error) return { galat: error.code === "42501" ? k.hanya : error.code === "22023" ? error.message : k.gagal };
  revalidatePath("/app/gaji/kasbon");
  return { pesan: isiTeks(k.tercatat, { bulan: Math.ceil(jumlah / cicilan) }) };
}
