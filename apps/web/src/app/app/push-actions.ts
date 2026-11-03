"use server";

import { headers } from "next/headers";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { bacaLangganan, namaPerangkat } from "@/lib/push";

const teksPush = async () => ambilKamus(await bahasaAplikasi()).pushPesan;
import { createClient } from "@/lib/supabase/server";

export type HasilPush = { galat?: string; pesan?: string };

/** Simpan (atau segarkan) langganan perangkat ini untuk usaha yang sedang dibuka. RLS memastikan milik pemanggil. */
export async function simpanLangganan(masukan: unknown): Promise<HasilPush> {
  const l = bacaLangganan(masukan);
  if (!l) return { galat: (await teksPush()).tidakLengkap };
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? "";
  const { error } = await supabase
    .from("langganan_push")
    .upsert({ ...l, perangkat: namaPerangkat(ua) }, { onConflict: "perusahaan_id,user_id,endpoint" });
  if (error) return { galat: (await teksPush()).gagalSimpan };
  return {};
}

export async function hapusLangganan(endpoint: string): Promise<HasilPush> {
  const supabase = await createClient();
  const { error } = await supabase.from("langganan_push").delete().eq("endpoint", endpoint);
  if (error) return { galat: (await teksPush()).gagalMatikan };
  return {};
}

export async function kirimPushUji(): Promise<HasilPush> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ terkirim: number; gagal: number[] }>("push", { body: { aksi: "uji" } });
  const t = await teksPush();
  if (error || !data) return { galat: t.gagalUji };
  if (data.terkirim === 0) return { galat: t.belumAda };
  return { pesan: isiTeks(t.terkirim, { n: data.terkirim }) };
}
