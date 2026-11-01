"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HasilIdentitas = { pesan: string } | { galat: string } | null;

/** NPWP pemotong dan ID TKU usaha yang sedang dibuka (F4-08). Pemilik atau akuntan. */
export async function aturIdentitas(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_identitas_pajak", { p_npwp: String(form.get("npwp") ?? ""), p_id_tku: String(form.get("id_tku") ?? "") || null });
  if (error) return { galat: error.code === "22023" ? error.message : error.code === "42501" ? "Hanya pemilik atau akuntan yang mengatur identitas pajak." : "Belum tersimpan. Coba lagi sebentar." };
  revalidatePath("/app/akuntan");
  return { pesan: "Tersimpan." };
}

/** Pemilik menambahkan akuntan lewat email akun Nadi (jawaban sama untuk email terdaftar atau tidak). */
export async function tambahAkuntan(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tambah_akuntan", { p_email: String(form.get("email") ?? "") });
  if (error) return { galat: error.code === "22023" ? error.message : error.code === "42501" ? "Hanya pemilik yang menambahkan akuntan." : "Belum tersimpan. Coba lagi sebentar." };
  revalidatePath("/app/akuntan");
  return { pesan: String(data) };
}

export async function cabutAkuntan(_: HasilIdentitas, form: FormData): Promise<HasilIdentitas> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cabut_akuntan", { p_user: String(form.get("user") ?? "") });
  if (error) return { galat: "Belum berhasil dicabut. Coba lagi sebentar." };
  revalidatePath("/app/akuntan");
  return { pesan: "Akses akuntan dicabut." };
}
