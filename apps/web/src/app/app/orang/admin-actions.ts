"use server";

import { revalidatePath } from "next/cache";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { TEKS_ADMIN } from "@/components/app/admin-teks";

// ADMIN-01: pemilik menjadikan akun Nadi lain admin dan mencabutnya (database memeriksa peran lewat add_admin dan remove_admin).
export type HasilAdmin = { pesan: string } | { galat: string } | null;
const ID = /^[0-9a-f-]{36}$/i;

export async function tambahAdmin(_: HasilAdmin, f: FormData): Promise<HasilAdmin> {
  const t = TEKS_ADMIN[await bahasaAplikasi()];
  if (f.get("paham") !== "ya") return { galat: t.wajibPaham };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_admin", { p_email: String(f.get("email") ?? "") });
  if (error) return { galat: error.code === "22023" ? t.emailSalah : error.code === "42501" ? t.hanyaPemilik : t.gagal };
  revalidatePath("/app/orang");
  return { pesan: t.bahasa === "id" ? String(data ?? t.ditambah) : t.ditambah };
}

export async function cabutAdmin(_: HasilAdmin, f: FormData): Promise<HasilAdmin> {
  const t = TEKS_ADMIN[await bahasaAplikasi()];
  const user = String(f.get("user") ?? "");
  if (!ID.test(user)) return { galat: t.gagalCabut };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_admin", { p_user: user });
  if (error) return { galat: error.code === "42501" ? t.hanyaPemilik : t.gagalCabut };
  revalidatePath("/app/orang");
  return { pesan: t.dicabutPesan };
}
