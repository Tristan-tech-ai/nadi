import { Suspense } from "react";
import { AksiPutusan } from "@/components/app/putusan";
import { KartuUsulan } from "@/components/ui/kartu-usulan";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

const SUMBER: Record<string, string> = { lempar: "Dari Lempar Saja", analis: "Dari Analis Malam", aturan: "Dari aturan", mcp: "Dari asisten AI-mu", mata: "Dari kamera" };

// Beranda aplikasi: Feed Keputusan (usulan menunggu, yang paling mendesak dan berdampak di atas).
async function Ringkasan() {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ count: orang }, { data: usulan }] = await Promise.all([
    supabase.from("orang").select("id", { count: "exact", head: true }),
    supabase.from("usulan").select("id, judul, penjelasan, sumber, keyakinan, dampak_rp").eq("status", "menunggu")
      .order("tenggat", { ascending: true, nullsFirst: false }).order("dampak_rp", { ascending: false, nullsFirst: false }).limit(20),
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
          <dd className="angka mt-1 text-2xl font-semibold">{usulan?.length ?? 0}</dd>
        </div>
      </dl>
      <h2 className="mt-8 text-lg font-semibold">Perlu keputusanmu</h2>
      {usulan?.length ? (
        <div className="mt-3 grid gap-3">
          {usulan.map((u) => (
            <KartuUsulan key={u.id} usulan={{ judul: u.judul, penjelasan: u.penjelasan ?? "", sumber: SUMBER[u.sumber] ?? u.sumber, keyakinan: u.keyakinan ?? undefined, dampakRp: u.dampak_rp ?? undefined }} aksi={<AksiPutusan usulanId={u.id} />} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="feed-kosong">
          Belum ada usulan. Lempar berkas pertamamu, misalnya foto nota hari ini, dan Nadi akan menyiapkan isinya untuk kamu setujui.
        </p>
      )}
    </section>
  );
}

export default function BerandaApp() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-8 h-40 w-full max-w-2xl animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Ringkasan />
      </Suspense>
    </main>
  );
}
