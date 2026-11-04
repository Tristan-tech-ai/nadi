import type { Metadata } from "next";
import { Suspense } from "react";
import { FormKeluar } from "@/components/serah/form-keluar";
import { LogoNadi } from "@/components/ui/logo";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Wawancara keluar", robots: { index: false } };

// F3-07D: tautan sekali pakai untuk orang yang berhenti. Token ada di fragmen URL (#nmw_...), jadi tidak masuk log server.
async function Isi() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).wawancaraKeluar;
  return (
    <div lang={bahasa}>
      <h1 className="mt-8 font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <FormKeluar teks={t} bahasa={bahasa} />
    </div>
  );
}

export default function HalamanKeluar() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-16">
      <LogoNadi />
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
