"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilIdentitas = { pesan: string } | { galat: string } | null;

/** Pesan Ruang Akuntan dalam bahasa pengguna; pesan database (bahasa Indonesia) dibungkus di bahasa lain. */
async function teksAkuntan() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).akuntanPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }), id: bahasa === "id" };
}

/** NPWP pemotong dan ID TKU usaha yang sedang dibuka (F4-08). Pemilik atau akuntan. */
export async function aturIdentitas(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const k = await teksAkuntan();
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_identitas_pajak", { p_npwp: String(form.get("npwp") ?? ""), p_id_tku: String(form.get("id_tku") ?? "") || null });
  if (error) return { galat: error.code === "22023" ? k.db(error.message) : error.code === "42501" ? k.hanyaIdentitas : k.belumTersimpan };
  revalidatePath("/app/akuntan");
  return { pesan: k.tersimpan };
}

/** Pemilik menambahkan akuntan lewat email akun Nadi (jawaban sama untuk email terdaftar atau tidak). */
export async function tambahAkuntan(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const k = await teksAkuntan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tambah_akuntan", { p_email: String(form.get("email") ?? "") });
  if (error) return { galat: error.code === "22023" ? k.db(error.message) : error.code === "42501" ? k.hanyaTambah : k.belumTersimpan };
  revalidatePath("/app/akuntan");
  return { pesan: k.id ? String(data ?? k.ditambah) : k.ditambah };
}

export async function cabutAkuntan(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const k = await teksAkuntan();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cabut_akuntan", { p_user: String(form.get("user") ?? "") });
  if (error) return { galat: k.gagalCabut };
  revalidatePath("/app/akuntan");
  return { pesan: k.dicabut };
}
