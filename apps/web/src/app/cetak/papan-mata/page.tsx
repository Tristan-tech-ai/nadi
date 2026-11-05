import type { Metadata } from "next";
import { Suspense } from "react";
import { TombolCetak } from "@/components/app/surat-keluar";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Papan informasi kamera", robots: { index: false } };

// W-02: papan informasi untuk area yang dipasangi kamera Mata (UU 27/2022 Pasal 17 ayat (1) huruf b). Selalu bahasa
// Indonesia karena dibaca pengunjung di toko. A4, dicetak dari peramban.
async function Lembar() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const { data } = await supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).maybeSingle();
  const usaha = (data as { nama: string } | null)?.nama ?? "";
  return (
    <article lang="id" className="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-kertas px-[20mm] py-[22mm] text-tinta print:min-h-0 print:p-0" data-testid="papan-mata">
      <p className="font-judul text-2xl font-extrabold">{usaha}</p>
      <h1 className="mt-10 font-judul text-5xl font-extrabold leading-tight">Area ini memakai kamera</h1>
      <p className="mt-6 text-2xl leading-snug">Kamera menghitung jumlah pengunjung, lama antre, dan lama di kasir supaya kami bisa mengatur pelayanan.</p>
      <ul className="mt-8 list-disc space-y-3 pl-8 text-xl leading-snug">
        <li>Gambar diproses di perangkat toko dan langsung dibuang.</li>
        <li>Tidak ada wajah yang dikenali atau disimpan.</li>
        <li>Yang dicatat hanya jumlah orang dan menit per jam.</li>
      </ul>
      <p className="mt-auto pt-10 text-lg">Pertanyaan tentang kamera ini: tanyakan ke kasir atau pengelola {usaha}.</p>
      <p className="mt-2 text-sm text-tinta-2">Dasar: Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 17.</p>
      <div className="mt-6 print:hidden"><TombolCetak /></div>
    </article>
  );
}

export default function HalamanPapanMata() {
  return (
    <main className="py-6 print:py-0">
      <Suspense fallback={<div className="mx-auto h-96 max-w-[210mm] animate-pulse bg-kertas-2" aria-hidden />}>
        <Lembar />
      </Suspense>
    </main>
  );
}
