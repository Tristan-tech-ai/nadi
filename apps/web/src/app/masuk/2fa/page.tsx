import type { Metadata } from "next";
import { Suspense } from "react";
import { Kode2fa } from "@/components/auth/kode-2fa";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { jalurAman } from "@/lib/auth-pesan";
import type { Kamus } from "@/lib/i18n/kamus";

export const metadata: Metadata = { title: "Kode verifikasi", robots: { index: false } };

async function Isi({ searchParams, teks }: { searchParams: PageProps<"/masuk/2fa">["searchParams"]; teks: Kamus["auth"] }) {
  const sp = await searchParams;
  return <Kode2fa next={jalurAman(typeof sp.next === "string" ? sp.next : null)} teks={teks} />;
}

// M-21: langkah kedua masuk untuk akun dengan verifikasi dua langkah.
export default function Masuk2fa(props: PageProps<"/masuk/2fa">) {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.duaJudul, sub: t.duaSub, badan: (
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} teks={t} />
      </Suspense>
    ) })} />
  );
}
