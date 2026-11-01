import type { Metadata } from "next";
import { Suspense } from "react";
import { LayarMata, type ModelMata } from "@/components/app/layar-mata";
import type { Zona } from "@/lib/mata/resep";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Mata" };

async function IsiMata() {
  await wajibPerusahaan();
  const supabase = await createClient();
  const [konf, zona] = await Promise.all([
    supabase.from("konfigurasi").select("nilai").eq("kunci", "model_mata").maybeSingle(),
    supabase.rpc("mata_keadaan"),
  ]);
  if (zona.error) {
    return <p className="mt-6 text-tinta-2" data-testid="mata-tanpa-izin">Mata hanya untuk pemilik atau admin usaha.</p>;
  }
  const model = konf.data?.nilai as ModelMata | undefined;
  if (!model?.id) {
    return <p role="alert" className="mt-6 text-tinta-2">Model penglihatan belum disiapkan untuk Nadi. Coba lagi nanti.</p>;
  }
  const awal = ((zona.data ?? []) as Zona[]).map((z) => ({ id: z.id, nama: z.nama, jenis: z.jenis, poligon: z.poligon }));
  return <LayarMata model={model} zonaAwal={awal} />;
}

export default function HalamanMata() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Mata</h1>
      <p className="mt-2 max-w-2xl text-tinta-2">
        Kamera tablet atau rekaman video membaca meja mana yang terisi dan berapa orang mengantre. Semua dihitung di perangkat ini;
        gambar tidak pernah dikirim.
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <IsiMata />
      </Suspense>
    </main>
  );
}
