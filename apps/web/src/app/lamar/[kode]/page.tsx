import type { Metadata } from "next";
import { Suspense } from "react";
import { FormLamar } from "@/components/lamar/form-lamar";
import { LogoNadi } from "@/components/ui/logo";
import { kodeSah } from "@/lib/lamar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lamar kerja", robots: { index: false } };

type Lowongan = { judul: string; ringkasan: string | null; usaha: string; buka: boolean };

async function Isi({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const supabase = await createClient();
  const { data } = kodeSah(kode) ? await supabase.rpc("lowongan_publik", { p_kode: kode }) : { data: null };
  const l = data as Lowongan | null;
  if (!l) return <p role="alert" className="mt-8 text-tinta-2" data-testid="lowongan-tidak-ada">Lowongan ini tidak ditemukan. Periksa lagi tautan yang kamu terima.</p>;
  return (
    <>
      <p className="mt-8 text-sm text-tinta-2">{l.usaha}</p>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{l.judul}</h1>
      {l.ringkasan && <p className="mt-2 whitespace-pre-line text-tinta-2">{l.ringkasan}</p>}
      {l.buka ? (
        <FormLamar kode={kode.toUpperCase()} usaha={l.usaha} />
      ) : (
        <p role="alert" className="mt-8 rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="lowongan-tutup">Lowongan ini sudah ditutup. Terima kasih sudah tertarik.</p>
      )}
    </>
  );
}

// Halaman lamar publik tanpa akun. Data lowongan lewat RPC anon lowongan_publik (judul, ringkasan, nama usaha saja).
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
