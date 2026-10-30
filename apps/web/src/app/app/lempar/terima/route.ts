import { NextResponse, type NextRequest } from "next/server";
import { lemparBerkas, mimeBerkas } from "@/lib/lempar";
import { createClient } from "@/lib/supabase/server";

// Tujuan share_target PWA (POST multipart dari menu Bagikan di HP). Berkas didaftarkan dan diunggah di sini (cepat),
// lalu halaman Lempar membacanya satu per satu sambil menampilkan kemajuan.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const berkas = form ? form.getAll("berkas").filter((f): f is File => typeof f !== "string").slice(0, 10) : [];
  const supabase = await createClient();
  const ids: string[] = [];
  let gagal = 0;
  for (const f of berkas) {
    const mime = mimeBerkas(f.name, f.type);
    const hasil = mime ? await lemparBerkas(supabase, { isi: await f.arrayBuffer(), nama: f.name, mime }, { baca: false }) : null;
    if (hasil && (hasil.status === "diunggah" || (hasil.status === "sudah" && hasil.berkasId))) ids.push(hasil.berkasId!);
    else gagal++;
  }
  const tujuan = request.nextUrl.clone();
  tujuan.pathname = "/app/lempar";
  tujuan.search = `?berkas=${ids.join(",")}${gagal ? `&gagal=${gagal}` : ""}`;
  return NextResponse.redirect(tujuan, 303);
}
