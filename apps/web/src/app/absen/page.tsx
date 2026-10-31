import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AbsenStaf } from "@/components/absen/absen-staf";
import { LogoNadi } from "@/components/ui/logo";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Absen", robots: { index: false } };

async function Isi({ searchParams }: { searchParams: PageProps<"/absen">["searchParams"] }) {
  await wajibPerusahaan();
  const sp = await searchParams;
  const tempat = typeof sp.t === "string" && /^[0-9a-f-]{36}$/i.test(sp.t) ? sp.t : null;
  const kode = typeof sp.k === "string" && /^\d{6}$/.test(sp.k) ? sp.k : null;
  if (!tempat || !kode) {
    return <p role="alert" className="mt-6 text-tinta-2">Kode QR tidak terbaca. Pindai ulang kode yang tampil di layar absen.</p>;
  }
  return (
    <div className="mt-6">
      <AbsenStaf tempat={tempat} kode={kode} />
    </div>
  );
}

export default function Absen(props: PageProps<"/absen">) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-16">
      <Link href="/app" aria-label="Kembali ke Nadi"><LogoNadi /></Link>
      <h1 className="mt-8 font-judul text-3xl font-extrabold tracking-tight">Absen</h1>
      <p className="mt-2 text-tinta-2">Pilih masuk atau pulang. Kode di layar berganti tiap 15 detik, jadi lanjutkan sekarang.</p>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
