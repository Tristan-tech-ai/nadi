import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormKode } from "@/components/auth/form-kode";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { jalurAman } from "@/lib/auth-pesan";
import { kodeEmailAktif } from "@/lib/auth/kode-email";
import type { Kamus } from "@/lib/i18n/kamus";

export const metadata: Metadata = { title: "Masuk dengan kode", robots: { index: false } };

async function Isi({ searchParams, teks: t }: { searchParams: PageProps<"/masuk/kode">["searchParams"]; teks: Kamus["auth"] }) {
  const sp = await searchParams;
  const next = jalurAman(typeof sp.next === "string" ? sp.next : null);
  return <>
    <FormKode jenis="masuk" next={next} teks={t} />
    <p className="mt-6 text-sm"><Link href={`/masuk?next=${encodeURIComponent(next)}`} className="text-tinta underline underline-offset-4">{t.kembaliMasuk}</Link></p>
  </>;
}

// Masuk tanpa kata sandi: kode angka dari email (cadangan bila tautan email tidak bisa dibuka).
export default function MasukKode(props: PageProps<"/masuk/kode">) {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.kodeJudul, sub: kodeEmailAktif() ? t.kodeSub : t.kodeSubTautan, badan: (
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} teks={t} />
      </Suspense>
    ) })} />
  );
}
