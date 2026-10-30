import { createBrowserClient } from "@supabase/ssr";

// Dipakai hanya untuk unggah berkas langsung ke Storage (menghindari batas ukuran badan permintaan fungsi server).
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string);
}
