import { NextResponse, type NextRequest } from "next/server";

// Tujuan share_target PWA (POST multipart dari menu Bagikan di HP). Pemrosesan berkas menyusul di F0-06 (Lempar Saja v1);
// untuk sekarang jumlah berkas dicatat di URL agar pengguna tahu kiriman diterima, lalu diarahkan ke halaman Lempar.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const n = form ? form.getAll("berkas").filter((f) => typeof f !== "string").length : 0;
  const tujuan = request.nextUrl.clone();
  tujuan.pathname = "/app/lempar";
  tujuan.search = `?dibagikan=${n}`;
  return NextResponse.redirect(tujuan, 303);
}
