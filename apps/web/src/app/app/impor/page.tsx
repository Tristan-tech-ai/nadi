import type { Metadata } from "next";
import { Suspense } from "react";
import { KalkulatorImpor } from "@/components/app/kalkulator-impor";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import type { AturanImpor } from "@/lib/impor/biaya";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Perkiraan biaya impor" };

// B-EKSIM2 (docs/research/ekspor-impor.md): perkiraan biaya mendarat impor dari aturan bertanggal terverifikasi pph22.impor dan
// ppn.impor (R-EKSIM2). Hitungan di peramban (src/lib/impor/biaya.ts), tidak disimpan; bukan billing resmi.

type Baris = { kunci: string; nilai: unknown; sumber: string; berlaku_dari: string };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.impor;
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <p className="mt-2 text-sm"><a href="/app/ekspor" className="underline underline-offset-4">{kamus.ekspor.judul}</a></p>
    </>
  );
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const supabase = await createClient();
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const { data } = await supabase.from("aturan_bertanggal").select("kunci, nilai, sumber, berlaku_dari")
    .in("kunci", ["pph22.impor", "ppn.impor"]).eq("terverifikasi", true).lte("berlaku_dari", hari).order("berlaku_dari", { ascending: false });
  const terbaru = (k: string) => ((data ?? []) as Baris[]).find((b) => b.kunci === k);
  const pph = terbaru("pph22.impor");
  const ppn = terbaru("ppn.impor");
  if (!pph || !ppn) return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-cap" data-testid="impor-belum">{t.belumTerverifikasi}</p></div>;
  const aturan = { pph22: pph.nilai, ppn: ppn.nilai } as AturanImpor;
  const isiLang = bahasa === "id" ? undefined : "id";
  return (
    <div lang={bahasa}>
      {kepala}
      <KalkulatorImpor aturan={aturan} teks={t} bahasa={bahasa} />
      <div className="mt-6 text-xs text-tinta-2" data-testid="sumber-impor">
        <p>{t.sumberJudul}</p>
        <ul className="mt-1 list-disc pl-5">
          <li lang={isiLang}>{pph.sumber}</li>
          <li lang={isiLang}>{ppn.sumber}</li>
        </ul>
      </div>
    </div>
  );
}

export default function HalamanImpor() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
