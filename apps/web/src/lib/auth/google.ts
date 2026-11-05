import "server-only";
import { cacheLife } from "next/cache";
import { readPublicEnv } from "@/lib/env";

// U-07: apakah penyedia Google sudah dinyalakan di Supabase Auth. Endpoint publik /auth/v1/settings memakai kunci publik
// (bukan rahasia) dan mengembalikan external.google. Disimpan beberapa menit; gagal dibaca dianggap belum menyala.
export async function googleAktif(): Promise<boolean> {
  "use cache";
  cacheLife("minutes");
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabasePublishableKey } });
    if (!r.ok) return false;
    const d = (await r.json()) as { external?: Record<string, boolean> };
    return d.external?.google === true;
  } catch {
    return false;
  }
}
