import type { ReactNode } from "react";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { KakiSitus, KepalaSitus } from "./kepala-kaki";

/** Kerangka halaman pendukung publik (D-15): kepala dan kaki situs, satu judul, isi rata kiri selebar baca. */
export function HalamanInfo({ judul, pengantar, draf, children, bahasa = "id" }: { judul: string; pengantar?: string; draf?: string; children: ReactNode; bahasa?: Bahasa }) {
  return (
    <div lang={bahasa} className="contents">
      <KepalaSitus bahasa={bahasa} />
      <main className="mx-auto w-full max-w-6xl px-5 pt-12 pb-20 lg:pt-16">
        <h1 className="font-judul text-[2rem] font-extrabold leading-tight tracking-tight sm:text-5xl">{judul}</h1>
        {pengantar && <p className="mt-4 max-w-2xl text-lg text-tinta-2">{pengantar}</p>}
        {draf && (
          <p className="mt-6 max-w-2xl border-l-4 border-cap pl-4 text-sm text-tinta" role="note">
            <span className="font-bold">Draf.</span> {draf}
          </p>
        )}
        <div className="isi-info mt-10 max-w-3xl">{children}</div>
      </main>
      <KakiSitus bahasa={bahasa} />
    </div>
  );
}

/** Satu bagian berjudul di halaman pendukung. */
export function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="border-t border-garis py-8">
      <h2 className="font-judul text-2xl font-extrabold tracking-tight">{judul}</h2>
      <div className="mt-3 space-y-3 text-tinta-2">{children}</div>
    </section>
  );
}
