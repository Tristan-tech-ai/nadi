import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { ambilBaris } from "@/lib/wawasan/ambil";
import { bacaPilihan, keCsv } from "@/lib/wawasan/laporan";

// M-23: unduh laporan buatan sendiri sebagai CSV (titik koma, BOM UTF-8 untuk Excel). Isi sama dengan pratinjau di /app/wawasan.
const teks = (pesan: string, status: number) => new Response(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request) {
  const sesi = await wajibPerusahaan();
  const t = ambilKamus(await bahasaAplikasi(sesi.bahasa)).wawasan;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return teks(t.hanyaPengelola, 403);
  const sp = new URL(request.url).searchParams;
  const p = bacaPilihan({ sumber: sp.get("sumber"), cari: sp.get("cari"), kolom: sp.getAll("kolom") });
  const { baris, galat } = await ambilBaris(await createClient(), p);
  if (galat) return teks(t.gagalBaca, 500);
  return new Response("﻿" + keCsv(baris, p.kolom, t.kolomNama), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="laporan-${p.sumber}.csv"`, "Cache-Control": "no-store" },
  });
}
