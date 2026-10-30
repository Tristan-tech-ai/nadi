"use server";

import { headers } from "next/headers";
import { bacaLangganan, namaPerangkat } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type HasilPush = { galat?: string; pesan?: string };

/** Simpan (atau segarkan) langganan perangkat ini untuk usaha yang sedang dibuka. RLS memastikan milik pemanggil. */
export async function simpanLangganan(masukan: unknown): Promise<HasilPush> {
  const l = bacaLangganan(masukan);
  if (!l) return { galat: "Data langganan dari browser tidak lengkap. Coba nyalakan ulang." };
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? "";
  const { error } = await supabase
    .from("langganan_push")
    .upsert({ ...l, perangkat: namaPerangkat(ua) }, { onConflict: "perusahaan_id,user_id,endpoint" });
  if (error) return { galat: "Nadi gagal menyimpan langganan. Buka usahamu dulu, lalu coba lagi." };
  return {};
}

export async function hapusLangganan(endpoint: string): Promise<HasilPush> {
  const supabase = await createClient();
  const { error } = await supabase.from("langganan_push").delete().eq("endpoint", endpoint);
  if (error) return { galat: "Nadi gagal mematikan pemberitahuan. Coba lagi sebentar." };
  return {};
}

export async function kirimPushUji(): Promise<HasilPush> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ terkirim: number; gagal: number[] }>("push", { body: { aksi: "uji" } });
  if (error || !data) return { galat: "Pemberitahuan uji gagal dikirim. Coba lagi sebentar." };
  if (data.terkirim === 0) return { galat: "Belum ada perangkat yang berlangganan untuk usaha ini." };
  return { pesan: `Pemberitahuan uji terkirim ke ${data.terkirim} perangkat.` };
}
