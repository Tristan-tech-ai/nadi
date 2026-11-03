import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/lib/env";
import { KUKI_BAHASA } from "@/lib/i18n/bahasa";

// Area yang butuh masuk. Selain ini publik (landing, lamaran kandidat, verifikasi surat).
const DILINDUNGI = ["/app", "/oauth/izinkan", "/absen", "/kios", "/cetak"];
// Pengecualian di dalam area terlindung: tablet kios memakai token tablet sendiri, bukan sesi.
const TERBUKA = ["/kios/tablet"];

// Menyegarkan sesi Supabase di setiap permintaan dan melindungi area aplikasi.
export async function proxy(request: NextRequest) {
  // API MCP memakai token akses sendiri, bukan sesi cookie.
  if (request.nextUrl.pathname.startsWith("/api/mcp")) return NextResponse.next();
  // Beranda: pengunjung yang pernah memilih English (cookie dari pemilih bahasa) langsung ke /en. Accept-Language tidak dipakai
  // untuk mengalihkan agar mesin pencari dan tautan bersama selalu melihat halaman yang sama (docs/research/i18n.md).
  // Hanya muatan dokumen penuh: permintaan RSC/prefetch dari router klien tidak dialihkan, kalau tidak prefetch "/" yang
  // tersimpan saat cookie masih en membuat tombol Bahasa Indonesia kembali ke /en (temuan e2e bahasa 3 Nov 2026).
  const dokumen = !request.headers.has("rsc") && !request.headers.has("next-router-prefetch");
  if (dokumen && request.nextUrl.pathname === "/" && request.cookies.get(KUKI_BAHASA)?.value === "en") {
    const url = request.nextUrl.clone();
    url.pathname = "/en";
    return NextResponse.redirect(url);
  }
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
