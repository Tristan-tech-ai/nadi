"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilAkses = { pesan: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).keamanan;
}

export async function simpanPeran(_: HasilAkses, form: FormData): Promise<HasilAkses> {
  const t = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_custom_role", { p_id: null, p_nama: String(form.get("nama") ?? ""), p_izin: form.getAll("izin").map(String) });
  if (error) return { galat: ["22023", "23505", "23514", "42501"].includes(error.code ?? "") ? error.message : t.gagal };
  revalidatePath("/app/akun/keamanan");
  return { pesan: t.peranTersimpan };
}

export async function beriPeran(_: HasilAkses, form: FormData): Promise<HasilAkses> {
  const t = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_custom_role", { p_user: String(form.get("user") ?? ""), p_role: String(form.get("peran") ?? "") || null });
  if (error) return { galat: ["22023", "P0002", "42501"].includes(error.code ?? "") ? error.message : t.gagal };
  revalidatePath("/app/akun/keamanan");
  return { pesan: t.peranDiberi };
}
