import { bacaJenis, bacaRentang, csvLaporan, type BukuBesar, type Laporan, type UmurPiutang } from "@/lib/buku/laporan";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

// M-01: unduh satu laporan keuangan sebagai CSV (pemisah titik koma, BOM UTF-8 agar Excel membaca huruf dengan benar).
// Angka sama persis dengan layar karena berasal dari RPC yang sama.
const teks = (pesan: string, status: number) => new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).buku;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return teks(t.hanyaPemilikAkuntan, 403);
  const sp = new URL(request.url).searchParams;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const { dari, sampai } = bacaRentang(sp.get("dari") ?? undefined, sp.get("sampai") ?? undefined, hari);
  const jenis = bacaJenis(sp.get("jenis"));
  const supabase = await createClient();
  let data: { laporan?: Laporan; buku?: BukuBesar; umur?: UmurPiutang };
  if (jenis === "buku_besar") {
    const r = await supabase.rpc("buku_besar", { p_kode: (sp.get("akun") ?? "").slice(0, 20), p_dari: dari, p_sampai: sampai });
    if (r.error) return teks(t.pilihAkun, 400);
    data = { buku: r.data as BukuBesar };
  } else if (jenis === "umur_piutang") {
    const r = await supabase.rpc("umur_piutang", { p_per: sampai });
    if (r.error) return teks(t.kosong, 500);
    data = { umur: r.data as UmurPiutang };
  } else {
    const r = await supabase.rpc("laporan_keuangan", { p_dari: dari, p_sampai: sampai });
    if (r.error) return teks(t.kosong, 500);
    data = { laporan: r.data as Laporan };
  }
  const kolom = Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const csv = "﻿" + csvLaporan(jenis, data, kolom);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${jenis}-${dari}-${sampai}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
