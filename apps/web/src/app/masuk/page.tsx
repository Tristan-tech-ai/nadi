import type { Metadata } from "next";
import { Suspense } from "react";
import { masuk } from "@/app/auth-actions";
import { FormAuth } from "@/components/auth/form-auth";
import { MasukGoogle } from "@/components/auth/masuk-google";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { jalurAman } from "@/lib/auth-pesan";
import type { Kamus } from "@/lib/i18n/kamus";

export const metadata: Metadata = { title: "Masuk ke Nadi" };

async function FormMasuk({ searchParams, teks }: { searchParams: PageProps<"/masuk">["searchParams"]; teks: Kamus["auth"] }) {
  const sp = await searchParams;
  const next = jalurAman(typeof sp.next === "string" ? sp.next : null);
  return <>{sp.galat === "tautan" ? <p role="alert" className="mb-4 rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{teks.tautanGagal}</p> : null}
    <FormAuth aksi={masuk} mode="masuk" next={next} teks={teks} /><MasukGoogle next={next} galat={sp.galat === "google"} teks={teks} /></>;
}

export default function Masuk(props: PageProps<"/masuk">) {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.masukJudul, sub: t.masukSub, badan: (
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <FormMasuk searchParams={props.searchParams} teks={t} />
      </Suspense>
    ) })} />
  );
}
