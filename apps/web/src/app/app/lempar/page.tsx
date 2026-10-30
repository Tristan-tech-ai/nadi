import type { Metadata } from "next";
import { Suspense } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";
import { Pelempar } from "@/components/app/pelempar";

export const metadata: Metadata = { title: "Lempar Saja" };

// Kiriman dari menu Bagikan (share target) sudah terunggah di server; id berkasnya dibawa lewat ?berkas= agar dibaca di sini.
async function DenganKiriman({ searchParams }: { searchParams: PageProps<"/app/lempar">["searchParams"] }) {
  const sp = await searchParams;
  const antre = String(sp.berkas ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
  const gagal = Number(sp.gagal ?? 0);
  return (
    <>
      {gagal > 0 ? (
        <p role="status" className="mt-4 rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap" data-testid="kiriman-gagal">
          {gagal} berkas dari menu Bagikan tidak bisa diterima (jenisnya belum dikenal atau lebih dari 10 MB).
        </p>
      ) : null}
      <Pelempar antre={antre} />
    </>
  );
}

export default function Lempar(props: PageProps<"/app/lempar">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <PaperPlaneTiltIcon size={32} aria-hidden />
      <h1 className="mt-4 font-judul text-3xl font-extrabold tracking-tight">Lempar Saja</h1>
      <p className="mt-2 text-tinta-2">Foto nota, slip gaji, KTP, CV, surat dokter, Excel karyawan, absen, atau mutasi bank. Nadi membacanya dan menyiapkan usulan untuk kamu setujui.</p>
      <Suspense fallback={<div className="mt-6 h-36 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <DenganKiriman searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
