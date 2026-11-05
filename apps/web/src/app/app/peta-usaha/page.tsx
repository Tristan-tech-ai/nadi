import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PetaPanas, type DataPanas } from "@/components/app/peta-panas";
import { PetaUsaha, type ZonaPeta } from "@/components/app/peta-usaha";
import { hariIni } from "@/lib/izin";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Peta usaha" };

async function IsiPeta() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.petaUsaha;
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/peta-usaha" judul={t.judul} ket={false} />
      <p className="mt-2 text-tinta-2">
        {t.ketAwal} <Link href="/app/mata" className="font-semibold underline underline-offset-4">{t.mata}</Link>.
      </p>
    </>
  );
  const supabase = await createClient();
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const awal = new Date(Date.parse(`${hari}T00:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10);
  const [{ data, error }, panas] = await Promise.all([supabase.rpc("vision_state"), supabase.rpc("vision_heatmap", { p_from: awal, p_to: hari })]);
  if (error) return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2" data-testid="peta-tanpa-izin">{t.tanpaIzin}</p></div>;
  return (
    <div lang={bahasa}>
      {kepala}
      <PetaUsaha awal={(data ?? []) as ZonaPeta[]} topik={`peta:${sesi.perusahaanId}`} privat judul={t.denahSekarang} teks={kamus.petaDenah} bahasa={bahasa} />
      {panas.data ? <PetaPanas data={panas.data as DataPanas} teks={kamus.petaPanas} bahasa={bahasa} /> : null}
    </div>
  );
}

export default function HalamanPeta() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <IsiPeta />
      </Suspense>
    </main>
  );
}
