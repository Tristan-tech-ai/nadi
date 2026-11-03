import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { LogoNadi } from "@/components/ui/logo";
import { ambilKamus, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

type TeksAuth = Kamus["auth"];

async function Isi({ isi }: { isi: (t: TeksAuth) => { judul: string; sub: string; badan: ReactNode } }) {
  // Belum masuk: bahasa dari cookie perangkat yang diset pemilih bahasa (I-02), jadi di balik Suspense.
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).auth;
  const { judul, sub, badan } = isi(t);
  return (
    <div lang={bahasa} className="flex flex-col">
      <Link href="/" aria-label={t.berandaAria} className="self-start">
        <LogoNadi />
      </Link>
      <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">{judul}</h1>
      <p className="mt-2 text-tinta-2">{sub}</p>
      <div className="mt-8">{badan}</div>
    </div>
  );
}

/** Kerangka halaman masuk/daftar: satu kolom, rata kiri, satu tombol utama. Teks dari kamus auth sesuai bahasa perangkat. */
export function KerangkaAuth({ isi }: { isi: (t: TeksAuth) => { judul: string; sub: string; badan: ReactNode } }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-16">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi isi={isi} />
      </Suspense>
    </main>
  );
}
