import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AbsenStaf } from "@/components/absen/absen-staf";
import { LogoNadi } from "@/components/ui/logo";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Absen", robots: { index: false } };

async function Isi({ searchParams }: { searchParams: PageProps<"/absen">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).absen;
  const sp = await searchParams;
  const tempat = typeof sp.t === "string" && /^[0-9a-f-]{36}$/i.test(sp.t) ? sp.t : null;
  const kode = typeof sp.k === "string" && /^\d{6}$/.test(sp.k) ? sp.k : null;
  return (
    <div lang={bahasa}>
      <Link href="/app" aria-label={t.kembaliAria}><LogoNadi /></Link>
      <h1 className="mt-8 font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {!tempat || !kode
        ? <p role="alert" className="mt-6 text-tinta-2">{t.qrTakTerbaca}</p>
        : <div className="mt-6"><AbsenStaf tempat={tempat} kode={kode} teks={t} /></div>}
    </div>
  );
}

export default function Absen(props: PageProps<"/absen">) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-16">
      <Suspense fallback={<div className="mt-6 h-72 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
