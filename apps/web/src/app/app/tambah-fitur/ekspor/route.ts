import { berkasEkspor, namaBerkas } from "@/lib/mod/berkas";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

// X-17 unduh berkas fitur tambahan (manifest versi aktif, tanpa catatan dan tanpa ID usaha) untuk diimpor di usaha lain.
// Hanya pemilik/admin; manifest dibaca lewat RLS (mod_baca) sehingga hanya fitur usaha sesi ini yang bisa diunduh.
const teks = (isi: string, status: number) => new Response(isi, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

export async function GET(req: Request) {
  const sesi = await wajibPerusahaan();
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return teks("Hanya pemilik atau admin yang bisa mengunduh fitur.", 403);
  const kode = new URL(req.url).searchParams.get("kode") ?? "";
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(kode)) return teks("Kode fitur tidak sah.", 400);
  const supabase = await createClient();
  const { data } = await supabase.from("mod").select("manifest, versi_aktif").eq("kode", kode).not("manifest", "is", null).maybeSingle();
  if (!data?.manifest) return teks("Fitur belum pernah diterapkan atau tidak ditemukan.", 404);
  return new Response(berkasEkspor(data.manifest, (data.versi_aktif as number | null) ?? null), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${namaBerkas(kode, (data.versi_aktif as number | null) ?? null)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
