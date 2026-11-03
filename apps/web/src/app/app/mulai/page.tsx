import type { Metadata } from "next";
import { Suspense } from "react";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { FormMulai } from "./form-mulai";

export const metadata: Metadata = { title: "Siapkan usahamu" };

// Bahasa dibaca dari akun/cookie, jadi isi di balik Suspense (Cache Components).
async function Isi() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).mulai;
  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold leading-tight tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      <div className="mt-8">
        <FormMulai teks={t} />
      </div>
    </div>
  );
}

export default function Mulai() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
