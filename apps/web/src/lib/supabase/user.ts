import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type AuthUser = { id: string; email: string | null };

/**
 * Pengguna masuk, dibaca dari klaim JWT yang diverifikasi di server ini (kunci publik JWKS di-cache),
 * bukan memanggil server Auth lewat jaringan. `auth.getUser()` butuh satu perjalanan pulang-pergi tiap panggilan,
 * dan satu halaman bisa memanggilnya 3 sampai 4 kali. Token kedaluwarsa tetap disegarkan oleh getClaims.
 */
export const getAuthUser = cache(async (supabase: SupabaseClient): Promise<AuthUser | null> => {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, email: typeof c.email === "string" ? c.email : null } : null;
});
