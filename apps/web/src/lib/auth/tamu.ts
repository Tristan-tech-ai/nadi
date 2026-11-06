import "server-only";
import { cacheLife } from "next/cache";
import { readPublicEnv } from "@/lib/env";
import { anonRpc } from "@/lib/mcp/http";

/** L-03: id usaha contoh yang dibuka sesi coba (konfigurasi usaha_tamu, lewat RPC publik usaha_tamu). */
export async function usahaTamu(): Promise<string | null> {
  "use cache";
  try {
    const id = (await anonRpc("usaha_tamu", {})) as string | null;
    cacheLife("hours");
    return id;
  } catch {
    cacheLife("seconds");
    return null;
  }
}

/** Apakah masuk anonim (mode coba) sudah dinyalakan di Supabase Auth; dibaca dari /auth/v1/settings publik seperti googleAktif. */
export async function cobaAktif(): Promise<boolean> {
  "use cache";
  cacheLife("minutes");
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabasePublishableKey } });
    if (!r.ok) return false;
    const d = (await r.json()) as { external?: Record<string, boolean> };
    return d.external?.anonymous_users === true;
  } catch {
    return false;
  }
}
