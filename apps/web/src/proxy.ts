import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/lib/env";

// Area yang butuh masuk. Selain ini publik (landing, lamaran kandidat, verifikasi surat).
const DILINDUNGI = ["/app", "/oauth/izinkan", "/absen", "/kios", "/cetak"];
// Pengecualian di dalam area terlindung: tablet kios memakai token tablet sendiri, bukan sesi.
const TERBUKA = ["/kios/tablet"];

// Menyegarkan sesi Supabase di setiap permintaan dan melindungi area aplikasi.
export async function proxy(request: NextRequest) {
  // API MCP memakai token akses sendiri, bukan sesi cookie.
  if (request.nextUrl.pathname.startsWith("/api/mcp")) return NextResponse.next();
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims memeriksa JWT secara lokal (tanpa jaringan) dan menyegarkan sesi bila kedaluwarsa.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims?.sub && !TERBUKA.includes(path) && DILINDUNGI.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|mediapipe/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)"],
};
