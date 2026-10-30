import type { Metadata } from "next";
import { Suspense } from "react";
import { masuk } from "@/app/auth-actions";
import { FormAuth } from "@/components/auth/form-auth";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { jalurAman } from "@/lib/auth-pesan";

export const metadata: Metadata = { title: "Masuk ke Nadi" };

async function FormMasuk({ searchParams }: { searchParams: PageProps<"/masuk">["searchParams"] }) {
  const sp = await searchParams;
  const next = jalurAman(typeof sp.next === "string" ? sp.next : null);
  return <FormAuth aksi={masuk} mode="masuk" next={next} />;
}

export default function Masuk(props: PageProps<"/masuk">) {
  return (
    <KerangkaAuth judul="Masuk" sub="Usulan, absen, dan uang usahamu menunggu di dalam.">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <FormMasuk searchParams={props.searchParams} />
      </Suspense>
    </KerangkaAuth>
  );
}
