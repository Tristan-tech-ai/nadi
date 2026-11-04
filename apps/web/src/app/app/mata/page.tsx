import type { Metadata } from "next";
import { Suspense } from "react";
import { LayarMata, type ModelMata } from "@/components/app/layar-mata";
import type { Zona } from "@/lib/mata/resep";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Mata" };

async function IsiMata() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).mata;
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">{t.ket}</p>
    </>
  );
  const supabase = await createClient();
  const [konf, zona] = await Promise.all([
    supabase.from("konfigurasi").select("nilai").eq("kunci", "model_mata").maybeSingle(),
    supabase.rpc("vision_state"),
  ]);
  if (zona.error) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2" data-testid="mata-tanpa-izin">{t.tanpaIzin}</p></div>;
  }
  const model = konf.data?.nilai as ModelMata | undefined;
  if (!model?.id) {
    return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-tinta-2">{t.belumModel}</p></div>;
  }
  const awal = ((zona.data ?? []) as Zona[]).map((z) => ({ id: z.id, nama: z.nama, jenis: z.jenis, poligon: z.poligon }));
  return <div lang={bahasa}>{kepala}<LayarMata model={model} zonaAwal={awal} teks={t} bahasa={bahasa} /></div>;
}

export default function HalamanMata() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <IsiMata />
      </Suspense>
    </main>
  );
}
