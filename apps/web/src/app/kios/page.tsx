import type { Metadata } from "next";
import { LayarKios } from "@/components/absen/layar-kios";
import { Suspense } from "react";
import { LogoNadi } from "@/components/ui/logo";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

// Bahasa dari akun (kios pemilik) atau cookie tablet, jadi teks di balik Suspense.
async function Isi() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).absen;
  return (
    <div lang={bahasa} className="flex w-full flex-col items-center">
      <h1 className="mt-6 text-center font-judul text-3xl font-extrabold tracking-tight">{t.kiosJudul}</h1>
      <p className="mt-2 mb-8 text-center text-tinta-2">{t.kiosKet}</p>
      <LayarKios teks={t} />
    </div>
  );
}

export const metadata: Metadata = { title: "Layar absen", robots: { index: false } };

// Mode kios: tablet di pintu masuk menampilkan QR absen. Staf memindainya dengan kamera HP.
export default function Kios() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center px-5 py-8">
      <LogoNadi />
      <Suspense fallback={<div className="mt-6 aspect-square w-full max-w-md animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
