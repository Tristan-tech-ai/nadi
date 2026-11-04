"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-11B: atasan langsung (atau delegasinya) memutus langkah pertama pengajuan izin/lembur; setelah setuju masuk Feed pemilik.
export type HasilLangkah = { pesan: string } | { galat: string } | null;

export async function putuskanLangkah(_: HasilLangkah, f: FormData): Promise<HasilLangkah> {
  const k = ambilKamus(await bahasaAplikasi()).hrPesan;
  const setuju = f.get("setuju") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("putuskan_langkah", { p_langkah: String(f.get("langkah") ?? ""), p_setuju: setuju, p_catatan: String(f.get("catatan") ?? "") });
  if (error) return { galat: error.code === "22023" || error.code === "P0002" ? error.message : k.gagal };
  revalidatePath("/app");
  return { pesan: setuju ? k.langkahSetuju : k.langkahTolak };
}
