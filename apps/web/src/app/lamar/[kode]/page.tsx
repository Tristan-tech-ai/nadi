import type { Metadata } from "next";
import { Suspense } from "react";
import { FormLamar } from "@/components/lamar/form-lamar";
import { LogoNadi } from "@/components/ui/logo";
import { kodeSah } from "@/lib/lamar";
import { asalSitus } from "@/lib/situs";
import { jobPosting, type LowonganPublik } from "@/lib/rekrut/job-posting";
import { createClient } from "@/lib/supabase/server";

type Lowongan = LowonganPublik & { pertanyaan?: unknown };
const ASAL = asalSitus();
const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

async function ambil(kode: string) {
  if (!kodeSah(kode)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("lowongan_publik", { p_kode: kode });
  return data as Lowongan | null;
}

// M-14: lowongan hanya diindeks bila pemilik memilih tampil di pencarian dan lowongan masih buka (data JobPosting ikut).
export async function generateMetadata({ params }: { params: Promise<{ kode: string }> }): Promise<Metadata> {
  const { kode } = await params;
  const l = await ambil(kode);
  const terindeks = !!l && !!jobPosting(l, kode.toUpperCase(), `${ASAL}/lamar/${kode.toUpperCase()}`, hariIni());
  return { title: l ? `${l.judul}, ${l.usaha}` : "Lamar kerja", robots: { index: terindeks, follow: terindeks },
    ...(terindeks ? { alternates: { canonical: `${ASAL}/lamar/${kode.toUpperCase()}` } } : {}) };
}

async function Isi({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const l = await ambil(kode);
  if (!l) return <p role="alert" className="mt-8 text-tinta-2" data-testid="lowongan-tidak-ada">Lowongan ini tidak ditemukan. Periksa lagi tautan yang kamu terima.</p>;
  const ld = jobPosting(l, kode.toUpperCase(), `${ASAL}/lamar/${kode.toUpperCase()}`, hariIni());
  return (
    <>
      {ld && <script type="application/ld+json" data-testid="job-posting" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <p className="mt-8 text-sm text-tinta-2">{l.usaha}</p>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{l.judul}</h1>
      {l.ringkasan && <p className="mt-2 whitespace-pre-line text-tinta-2">{l.ringkasan}</p>}
      {l.buka ? (
        <FormLamar kode={kode.toUpperCase()} usaha={l.usaha} pertanyaan={Array.isArray(l.pertanyaan) ? l.pertanyaan.filter((p): p is string => typeof p === "string") : []} />
      ) : (
        <p role="alert" className="mt-8 rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="lowongan-tutup">Lowongan ini sudah ditutup. Terima kasih sudah tertarik.</p>
      )}
    </>
  );
}

// Halaman lamar publik tanpa akun. Data lowongan lewat RPC anon lowongan_publik (judul, ringkasan, nama usaha, pertanyaan wawancara).
export default function Lamar(props: { params: Promise<{ kode: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <LogoNadi />
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}
