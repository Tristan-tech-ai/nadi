import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

// Beranda aplikasi sementara: Feed Keputusan menyusul di F0-05.
async function Ringkasan() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ count: orang }, { count: usulan }] = await Promise.all([
    supabase.from("orang").select("id", { count: "exact", head: true }),
    supabase.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
  ]);
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Hari ini</h1>
      <p className="mt-2 text-tinta-2" data-testid="peran">Kamu masuk sebagai {sesi.peran}.</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Orang tercatat</dt>
          <dd className="angka mt-1 text-2xl font-semibold" data-testid="jumlah-orang">{orang ?? 0}</dd>
        </div>
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
          <dt className="text-sm text-tinta-2">Usulan menunggu</dt>
          <dd className="angka mt-1 text-2xl font-semibold">{usulan ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function BerandaApp() {
  return (
    <Suspense fallback={<div className="mx-auto mt-8 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
      <Ringkasan />
    </Suspense>
  );
}
