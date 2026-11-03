import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "@/lib/env";

// Dipakai untuk unggah berkas langsung ke Storage (menghindari batas ukuran badan permintaan fungsi server) dan untuk Realtime.
// Env publik dirujuk secara literal supaya ditanam saat build, lalu dirapikan readPublicEnv (CRLF di ujung memutus WebSocket).
export function createBrowserSupabase() {
  const env = readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
