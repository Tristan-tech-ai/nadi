import type { Metadata } from "next";
import { Suspense } from "react";
import { RekamIlmu, type ButirIlmu } from "@/components/app/rekam-ilmu";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
// Konstanta dari modul biasa, bukan dari berkas "use client" (yang di server hanya referensi klien: tampil NaN:NaN).
import { DURASI_ILMU_DETIK, formatDurasi } from "@/lib/wawancara/rekam";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Rekam ilmu", robots: { index: false } };

// F3-07C (docs/design/serah-terima-layar.md bagian 2): orang yang berhenti merekam penjelasan butir ilmunya di HP-nya sendiri.
// RLS serah_butir_baca_ilmu_sendiri hanya memperlihatkan butir ilmu miliknya selama paket masih disiapkan.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).rekamIlmu;
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/ilmu" judul={t.judul} ket={t.ket} />
    </>
  );
  if (sesi.peran === "pemilik" || sesi.peran === "admin") {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2" data-testid="ilmu-bukan-untukmu">{t.bukanUntukmu}</p></div>;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("serah_butir").select("id, judul, durasi_detik").eq("jenis", "ilmu").order("dibuat_at");
  const butir = (data ?? []) as ButirIlmu[];
  return (
    <div lang={bahasa}>
      {kepala}
      {butir.length === 0 ? (
        <p className="mt-6 text-tinta-2" data-testid="ilmu-kosong">{t.kosong}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-tinta-2" data-testid="batas-ilmu">{isiTeks(t.batas, { maks: formatDurasi(DURASI_ILMU_DETIK) })}</p>
          <ul className="mt-6 flex flex-col gap-4" data-testid="daftar-ilmu">
            {butir.map((b) => <RekamIlmu key={b.id} butir={b} teks={t} bahasa={bahasa} />)}
          </ul>
        </>
      )}
    </div>
  );
}

export default function HalamanIlmu() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
