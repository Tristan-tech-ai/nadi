import { headers } from "next/headers";
import { POLA_KERJA, polaSah } from "@/lib/gaji/pola-kerja";
import { hariIni } from "@/lib/izin";
import { resourceMcp } from "@/lib/mcp/http";
import { wajibPerusahaan } from "@/lib/sesi";
import { periksaSkill, susunSkill, zipSkill } from "@/lib/skill/paket";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

// F6-05: unduh paket skill asisten AI (zip berformat Agent Skills) untuk usaha yang sedang dibuka. Pemilik, admin, akuntan;
// data dibaca lewat RLS pengguna ini, tanpa nama orang, gaji, NIK, atau rekening (lihat src/lib/skill/paket.ts).
export async function GET() {
  const sesi = await wajibPerusahaan();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return new Response("Paket skill hanya untuk pemilik, admin, dan akuntan.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const supabase = await createClient();
  const [{ data: usaha }, { data: topi }, { data: aturan }, { data: izin }, { data: nomor }, { data: akun }, zona] = await Promise.all([
    supabase.from("perusahaan").select("nama, kode, industri").eq("id", sesi.perusahaanId).maybeSingle(),
    supabase.from("topi").select("nama, pakai_topi(orang_id, selesai)").eq("aktif", true).order("nama"),
    supabase.rpc("aturan_kerja"),
    supabase.from("kebijakan_izin").select("jenis, otomatis, maks_hari_otomatis, butuh_bukti").order("jenis"),
    supabase.from("templat_nomor").select("jenis, nama, templat").eq("aktif", true).order("jenis"),
    supabase.from("akun").select("kode, nama").eq("aktif", true).order("kode"),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  if (!usaha) return new Response("Usaha tidak ditemukan.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const hari = hariIni(new Date(), zona);
  const pola = (aturan as { pola_kerja?: string } | null)?.pola_kerja;
  const paket = susunSkill({
    usaha: { nama: usaha.nama, kode: usaha.kode, industri: usaha.industri, zona },
    mcpUrl: resourceMcp(await headers()),
    topi: ((topi ?? []) as { nama: string; pakai_topi: { orang_id: string; selesai: string | null }[] }[]).map((t) => ({
      nama: t.nama,
      orang: new Set(t.pakai_topi.filter((p) => !p.selesai || p.selesai >= hari).map((p) => p.orang_id)).size,
    })),
    polaKerja: polaSah(pola) ? POLA_KERJA[pola].judul : null,
    izin: ((izin ?? []) as { jenis: string; otomatis: boolean; maks_hari_otomatis: number | null; butuh_bukti: boolean }[])
      .map((i) => ({ jenis: i.jenis, otomatis: i.otomatis, maksHari: i.maks_hari_otomatis, butuhBukti: i.butuh_bukti })),
    nomor: (nomor ?? []) as { jenis: string; nama: string; templat: string }[],
    akun: (akun ?? []) as { kode: string; nama: string }[],
    dibuat: hari,
  });
  const masalah = periksaSkill(paket.nama, paket.berkas["SKILL.md"]);
  if (masalah.length) return new Response(`Paket skill tidak sah: ${masalah.join("; ")}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(zipSkill(paket) as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${paket.nama}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
