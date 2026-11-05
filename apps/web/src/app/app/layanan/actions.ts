"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilLayanan = { pesan: string } | { galat: string } | null;

const teks = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const uuid = (f: FormData, k: string) => (/^[0-9a-f-]{36}$/i.test(teks(f, k)) ? teks(f, k) : null);

async function siap() {
  const k = ambilKamus(await bahasaAplikasi()).layananPesan;
  const supabase = await createClient();
  const salah = (e: { code?: string; message: string }) => ({ galat: e.code === "42501" ? k.hanya : isiTeks(k.galatDb, { pesan: e.message }) });
  return { k, supabase, salah };
}
const segarkan = () => revalidatePath("/app/layanan");

export async function simpanAtur(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_support_setting", {
    p_aktif: f.get("aktif") === "on", p_mulai: teks(f, "mulai"), p_selesai: teks(f, "selesai"), p_sla: Number(teks(f, "sla")), p_sambutan: teks(f, "sambutan"), p_luar_jam: teks(f, "luar_jam"),
  });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.atur };
}

export async function simpanArtikel(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_support_article", { p_id: uuid(f, "id"), p_judul: teks(f, "judul"), p_isi: teks(f, "isi"), p_aktif: true });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.artikel };
}

export async function balasObrolan(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase } = await siap();
  const { error } = await supabase.rpc("reply_conversation", { p_id: uuid(f, "id"), p_isi: teks(f, "isi") });
  if (error) return { galat: error.code === "42501" ? k.hanyaAgen : isiTeks(k.galatDb, { pesan: error.message }) };
  segarkan();
  return { pesan: k.balas };
}

export async function tutupObrolan(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("close_conversation", { p_id: uuid(f, "id") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.tutup };
}

export async function simpanTemplat(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("save_reply_template", { p_judul: teks(f, "judul"), p_isi: teks(f, "isi") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.templat };
}

export async function tugaskanObrolan(_: HasilLayanan, f: FormData): Promise<HasilLayanan> {
  const { k, supabase, salah } = await siap();
  const { error } = await supabase.rpc("assign_conversation", { p_id: uuid(f, "id"), p_agen: uuid(f, "agen") });
  if (error) return salah(error);
  segarkan();
  return { pesan: k.tugas };
}
