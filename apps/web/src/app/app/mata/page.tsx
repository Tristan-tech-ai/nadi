import type { Metadata } from "next";
import { Suspense } from "react";
import { HitungKunjungan } from "@/components/app/hitung-kunjungan";
import { LayarMata, type ModelMata } from "@/components/app/layar-mata";
import type { Zona } from "@/lib/mata/resep";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Mata" };

async function IsiMata() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.mata;
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/mata" judul={t.judul} ket={t.ket} />
    </>
  );
  const supabase = await createClient();
  const hari = new Date().toISOString().slice(0, 10);
  const [konf, zona, panas] = await Promise.all([
    supabase.from("konfigurasi").select("nilai").eq("kunci", "model_mata").maybeSingle(),
    supabase.rpc("vision_state"),
    supabase.rpc("vision_heatmap", { p_from: hari, p_to: hari }),
  ]);
  if (zona.error) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2" data-testid="mata-tanpa-izin">{t.tanpaIzin}</p></div>;
  }
  const model = konf.data?.nilai as ModelMata | undefined;
  if (!model?.id) {
    return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-tinta-2">{t.belumModel}</p></div>;
  }
  const awal = ((zona.data ?? []) as Zona[]).map((z) => ({ id: z.id, nama: z.nama, jenis: z.jenis, poligon: z.poligon }));
  const papan = Boolean((panas.data as { papan?: unknown } | null)?.papan);
  return (
    <div lang={bahasa}>
      {kepala}
      <LayarMata model={model} zonaAwal={awal} teks={t} bahasa={bahasa} />
      <HitungKunjungan zona={awal} papanAwal={papan} model={model} teks={kamus.kunjungan} bahasa={bahasa} />
    </div>
  );
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
