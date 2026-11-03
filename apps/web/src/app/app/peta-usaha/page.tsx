import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PetaUsaha, type ZonaPeta } from "@/components/app/peta-usaha";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Peta usaha" };

async function IsiPeta() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mata_keadaan");
  if (error) return <p className="mt-6 text-tinta-2" data-testid="peta-tanpa-izin">Peta usaha hanya untuk pemilik atau admin.</p>;
  return <PetaUsaha awal={(data ?? []) as ZonaPeta[]} topik={`peta:${sesi.perusahaanId}`} privat judul="Denah sekarang" />;
}

export default function HalamanPeta() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Peta usaha</h1>
      <p className="mt-2 text-tinta-2">
        Meja terisi dan antrean dari Mata, diperbarui sendiri saat berubah. Zona diatur di <Link href="/app/mata" className="font-semibold underline underline-offset-4">Mata</Link>.
      </p>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <IsiPeta />
      </Suspense>
    </main>
  );
}
