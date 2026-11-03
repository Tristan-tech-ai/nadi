"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { adaBahasa, KUKI_BAHASA, UMUR_KUKI_BAHASA } from "@/lib/i18n/bahasa";
import { createClient } from "@/lib/supabase/server";

/**
 * Simpan pilihan bahasa (I-02): cookie untuk perangkat ini, dan user_metadata.bahasa untuk pengguna yang masuk agar ikut
 * ke perangkat lain. Sesi disegarkan supaya klaim JWT membawa pilihan baru.
 */
export async function aturBahasa(bahasa: string): Promise<{ ok: boolean }> {
  if (!adaBahasa(bahasa)) return { ok: false };
  (await cookies()).set(KUKI_BAHASA, bahasa, { path: "/", maxAge: UMUR_KUKI_BAHASA, sameSite: "lax" });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    const { error } = await supabase.auth.updateUser({ data: { bahasa } });
    if (error) return { ok: false };
    await supabase.auth.refreshSession();
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
