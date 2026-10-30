import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { readPublicEnv } from "@/lib/env";

// Satu klien per permintaan: layout, halaman, dan komponen yang memanggilnya bersama tidak membuat klien berulang.
// Pelacak opsional (DB_TRACE=1): mencatat tiap panggilan ke Supabase dengan waktu mulai dan lama, untuk mencari urutan query yang menumpuk.
const traced: typeof fetch | undefined = process.env.DB_TRACE
  ? async (input, init) => {
      const t0 = Date.now();
      const res = await fetch(input, init);
      const u = String(input instanceof Request ? input.url : input).replace(/^https?:\/\/[^/]+/, "").slice(0, 70);
      console.log(`[db] +${t0 % 100000}ms ${Date.now() - t0}ms ${u}`);
      return res;
    }
  : undefined;

export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    ...(traced ? { global: { fetch: traced } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Dipanggil dari Server Component: penyegaran sesi ditangani proxy.
        }
      },
    },
  });
});
