import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBatalEkspor, FormEkspor } from "@/components/app/ekspor";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatBerat, formatKurs, formatUsd } from "@/lib/ekspor/hitung";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Invoice ekspor" };

// B-EKSIM1 (docs/research/ekspor-impor.md): invoice + packing list ekspor USD dengan kurs tercatat; dokumen cetak berbahasa Inggris
// di /cetak/ekspor/<id>. Nadi tidak mengisi PEB.

type Ekspor = {
  id: string; nomor: string; pembeli: string; negara: string; incoterm: string; tempat_incoterm: string; total_usd: number; total_rupiah: number;
  kurs: number; kurs_sumber: string; kurs_tanggal: string; berat_bersih_kg: number; berat_kotor_kg: number; koli: number; jatuh_tempo: string;
  status: "terbit" | "batal"; alasan_batal: string | null;
};

const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.ekspor;
  const f = kamus.eksporForm;
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <p className="mt-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="tanpa-peb">{t.peb}</p>
      <p className="mt-2 flex flex-wrap gap-4 text-sm"><a href="/app/invoice" className="underline underline-offset-4">{kamus.invoice.judul}</a><a href="/app/impor" className="underline underline-offset-4" data-testid="tautan-impor">{kamus.impor.judul}</a></p>
    </>
  );
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const supabase = await createClient();
  const [inv, zona] = await Promise.all([
    supabase.from("invoice_ekspor").select("id, nomor, pembeli, negara, incoterm, tempat_incoterm, total_usd, total_rupiah, kurs, kurs_sumber, kurs_tanggal, berat_bersih_kg, berat_kotor_kg, koli, jatuh_tempo, status, alasan_batal")
      .order("dibuat_at", { ascending: false }).limit(50),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  if (inv.error) return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-cap">{t.gagalMuat}</p></div>;
  const daftar = (inv.data ?? []) as Ekspor[];
  const hari = hariIni(new Date(), zona);
  return (
    <div lang={bahasa}>
      {kepala}
      <section className="mt-8" aria-labelledby="judul-baru">
        <h2 id="judul-baru" className="text-lg font-semibold">{t.baruJudul}</h2>
        <FormEkspor kunci={randomUUID()} hariIni={hari} jatuhTempo={geser(hari, 30)} teks={f} bahasa={bahasa} />
      </section>
      <section className="mt-8" aria-labelledby="judul-daftar">
        <h2 id="judul-daftar" className="text-lg font-semibold">{t.daftarJudul}</h2>
        {daftar.length === 0 ? <p className="mt-1 text-sm text-tinta-2" data-testid="ekspor-kosong">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-ekspor">
            {daftar.map((i) => (
              <li key={i.id} className="grid gap-2 py-3" data-testid="baris-daftar-ekspor" data-nomor={i.nomor}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold"><span data-pengguna>{i.pembeli}</span> <span className="font-mono text-xs font-normal">{i.nomor}</span></p>
                    <p className="text-sm text-tinta-2"><span data-pengguna>{i.negara}</span>, {i.incoterm} <span data-pengguna>{i.tempat_incoterm}</span></p>
                    <p className="text-sm text-tinta-2" data-testid="kurs-ekspor">
                      {isiTeks(t.kurs, { kurs: formatKurs(Number(i.kurs), bahasa), tanggal: tgl(i.kurs_tanggal) })}{" "}
                      <span data-pengguna>{i.kurs_sumber}</span>
                    </p>
                    <p className="text-sm text-tinta-2">{isiTeks(t.berat, { koli: i.koli, bersih: formatBerat(Number(i.berat_bersih_kg), bahasa), kotor: formatBerat(Number(i.berat_kotor_kg), bahasa) })}</p>
                    <p className="text-sm text-tinta-2">{i.status === "batal" ? <>{t.dibatalkan} <span data-pengguna>{i.alasan_batal}</span></> : isiTeks(t.jatuhTempo, { tanggal: tgl(i.jatuh_tempo) })}</p>
                  </div>
                  <div className="text-right">
                    <p className="angka font-semibold" lang="en">{formatUsd(Math.round(Number(i.total_usd) * 100))}</p>
                    <Rupiah nilai={Number(i.total_rupiah)} className="text-sm text-tinta-2" bahasa={bahasa} />
                    <div className="mt-1">{i.status === "batal" ? <Cap jenis="ditolak" label={t.batal} /> : <Cap jenis="menunggu" label={t.terbit} />}</div>
                  </div>
                </div>
                <a href={`/cetak/ekspor/${i.id}`} className="text-sm font-semibold underline underline-offset-4" target="_blank" rel="noopener noreferrer" hrefLang="en" data-testid="cetak-ekspor">{t.cetak}</a>
                {i.status === "terbit" && <FormBatalEkspor invoice={i.id} label={i.nomor} teks={f} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HalamanEkspor() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
