"use server";

import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type KodeKios = { tempat: string; kode: string; sisa: number } | { galat: string };

/** Kode absen saat ini untuk layar kios (pemilik/admin). Rahasia TOTP tetap di database. */
export async function ambilKodeKios(): Promise<KodeKios> {
  const k = ambilKamus(await bahasaAplikasi()).absen;
  const supabase = await createClient();
  const { data: tempat, error: e1 } = await supabase.rpc("tempat_absen_utama");
  if (e1 || !tempat) return { galat: k.kiosHanya };
  const { data, error } = await supabase.rpc("kode_absen", { p_tempat: tempat });
  if (error || !data) return { galat: k.kodeGagal };
  const d = data as { kode: string; sisa_detik: number };
  return { tempat: tempat as string, kode: d.kode, sisa: d.sisa_detik };
}
