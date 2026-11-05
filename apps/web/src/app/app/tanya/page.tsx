import type { Metadata } from "next";
import { Suspense } from "react";
import { FormTanya } from "@/components/app/tanya";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Tanya data" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).tanya;
  const boleh = ["pemilik", "admin", "akuntan"].includes(sesi.peran);
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/tanya" judul={t.judul} ket={t.ket} />
      {boleh ? <FormTanya contoh={t.contohDaftar} bahasa={bahasa} teks={t} /> : <p className="mt-4 text-tinta-2">{t.hanyaPengelola}</p>}
    </div>
  );
}

export default function HalamanTanya() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
