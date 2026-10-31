"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { tautanTablet } from "@/lib/absen/kios";
import { asalTautan } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";

export type HasilTautan = { tautan: string; nama: string } | { galat: string } | null;

/** Buat tautan tablet absen. Token mentah hanya muncul sekali di layar pemilik; database menyimpan hash-nya. */
export async function buatTautanTablet(_: HasilTautan, form: FormData): Promise<HasilTautan> {
  const nama = String(form.get("nama") ?? "").trim().slice(0, 40) || "Tablet";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_token_kios", { p_nama: nama });
  if (error || !data) return { galat: "Tautan tablet gagal dibuat. Hanya pemilik atau admin yang bisa membuatnya." };
  revalidatePath("/app/perusahaan");
  return { tautan: tautanTablet(asalTautan(await headers()), (data as { token: string }).token), nama };
}

export async function cabutTablet(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.rpc("cabut_token_kios", { p_id: id });
  revalidatePath("/app/perusahaan");
}
