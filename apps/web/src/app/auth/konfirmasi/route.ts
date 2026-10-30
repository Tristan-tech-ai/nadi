import { NextResponse, type NextRequest } from "next/server";
import { jalurAman } from "@/lib/auth-pesan";
import { createClient } from "@/lib/supabase/server";

// Tautan konfirmasi email (alur PKCE @supabase/ssr): tukar kode menjadi sesi, lalu lanjut ke tujuan internal.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = jalurAman(url.searchParams.get("next"), "/app");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const supabase = await createClient();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })).error;
  const tujuan = url.clone();
  tujuan.search = "";
  tujuan.pathname = ok ? next : "/masuk";
  if (!ok) tujuan.searchParams.set("galat", "tautan");
  return NextResponse.redirect(tujuan);
}
