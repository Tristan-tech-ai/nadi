"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// W-08 pintu data: pemilik/admin membuat token nmi_ (ditampilkan sekali) dan mencabutnya.
export type HasilPintu = { pesan: string; token?: string } | { galat: string } | null;

async function teks() {
  return ambilKamus(await bahasaAplikasi()).pintuPesan;
}
const galat = (k: Awaited<ReturnType<typeof teks>>, e: { code?: string; message: string }): HasilPintu =>
  ({ galat: e.code === "42501" ? k.hanya : ["22023", "P0002", "54000"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });

export async function buatPintu(_: HasilPintu, form: FormData): Promise<HasilPintu> {
  const k = await teks();
  const batas = Number(String(form.get("batas") ?? "100").trim());
  if (!Number.isInteger(batas)) return { galat: k.batasRusak };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_pintu_data", { p_nama: String(form.get("nama") ?? ""), p_batas: batas });
  if (error) return galat(k, error);
  revalidatePath("/app/perusahaan");
  return { pesan: k.dibuat, token: data as string };
}

export async function cabutPintu(_: HasilPintu, form: FormData): Promise<HasilPintu> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cabut_pintu_data", { p_id: String(form.get("id") ?? "") });
  if (error) return galat(k, error);
  revalidatePath("/app/perusahaan");
  return { pesan: k.dicabut };
}
