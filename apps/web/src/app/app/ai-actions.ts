"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Cabut semua token (akses dan penyegar) satu asisten AI di usaha yang sedang dibuka. RLS membatasi ke token milik pemanggil. */
export async function cabutAsisten(form: FormData): Promise<void> {
  const clientId = String(form.get("client_id") ?? "");
  if (!clientId) return;
  const supabase = await createClient();
  await supabase.from("mcp_token").update({ dicabut_at: new Date().toISOString() }).eq("client_id", clientId).is("dicabut_at", null);
  revalidatePath("/app/perusahaan");
}
