import type { Metadata } from "next";
import { Suspense } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = { title: "Lempar Saja" };

async function Kiriman({ searchParams }: { searchParams: PageProps<"/app/lempar">["searchParams"] }) {
  const n = Number((await searchParams).dibagikan ?? NaN);
  if (!Number.isFinite(n)) return null;
  return <p role="status" className="mt-4 rounded-[var(--radius-isian)] border border-daun px-3 py-2 text-sm text-daun" data-testid="kiriman">{n} berkas diterima dari menu Bagikan.</p>;
}

export default function Lempar(props: PageProps<"/app/lempar">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <PaperPlaneTiltIcon size={32} aria-hidden />
      <h1 className="mt-4 font-judul text-3xl font-extrabold tracking-tight">Lempar Saja</h1>
      <p className="mt-2 text-tinta-2">Foto nota, slip, KTP, Excel karyawan, atau mutasi bank: lempar ke sini, Nadi yang merapikan. Bisa juga lewat menu Bagikan di HP setelah Nadi dipasang.</p>
      <Suspense fallback={null}><Kiriman searchParams={props.searchParams} /></Suspense>
      <p className="mt-6 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-sm text-tinta-2">Pembaca berkas sedang disiapkan. Kiriman sudah bisa diterima; pemrosesannya menyusul.</p>
    </main>
  );
}
