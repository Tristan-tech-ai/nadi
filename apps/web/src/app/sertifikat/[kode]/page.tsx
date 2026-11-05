import type { Metadata } from "next";
import { Suspense } from "react";
import { TombolCetak } from "@/components/app/surat-keluar";
import { LogoNadi } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/server";

// M-13B: sertifikat kursus untuk dicetak atau disimpan sebagai PDF dari peramban, sekaligus halaman verifikasi lewat kode acak
// 12 heksa. Bahasa Indonesia: sertifikat diterbitkan usaha di Indonesia untuk karyawannya.
export const metadata: Metadata = { title: "Sertifikat kursus", robots: { index: false, follow: false } };

type Sertifikat = { usaha: string; nama: string; kursus: string; nomor: string; skor: number; terbit: string; zona: string };

async function Isi({ params }: { params: PageProps<"/sertifikat/[kode]">["params"] }) {
  const { kode } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9A-Fa-f]{12}$/.test(kode) ? await supabase.rpc("verify_certificate", { p_kode: kode }) : { data: null };
  const s = data as Sertifikat | null;
  if (!s) return <p role="alert" className="mt-8 text-tinta-2" data-testid="sertifikat-tidak-ada">Sertifikat tidak ditemukan. Periksa lagi kode pada sertifikat.</p>;
  const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: s.zona || "Asia/Jakarta" }).format(new Date(s.terbit));
  return (
    <>
      <article className="mt-8 rounded-[var(--radius-kartu)] border-2 border-tinta p-6 text-center sm:p-12 print:mt-0 print:border-4" data-testid="sertifikat">
        <p className="text-sm uppercase tracking-widest text-tinta-2">Sertifikat</p>
        <p className="mt-6 text-tinta-2">Diberikan kepada</p>
        <h1 className="mt-2 font-judul text-3xl font-extrabold tracking-tight sm:text-5xl">{s.nama}</h1>
        <p className="mt-6 text-tinta-2">karena lulus kursus</p>
        <p className="mt-2 text-xl font-semibold">{s.kursus}</p>
        <p className="mt-2">dengan nilai <span className="angka">{s.skor}</span></p>
        <p className="mt-8">{s.usaha}, {tanggal}</p>
        <p className="mt-6 font-mono text-sm">{s.nomor}</p>
        <p className="mt-1 text-xs text-tinta-2">Kode verifikasi <span className="font-mono">{kode.toUpperCase()}</span></p>
      </article>
      <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
        <TombolCetak />
        <p className="text-sm text-tinta-2">Sertifikat ini terbaca dari data {s.usaha} di Nadi.</p>
      </div>
    </>
  );
}

export default function HalamanSertifikat(props: PageProps<"/sertifikat/[kode]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 print:max-w-none print:p-0">
      <div className="print:hidden"><LogoNadi /></div>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
