import type { Metadata } from "next";
import { Suspense } from "react";
import { TombolCetak } from "@/components/app/surat-keluar";
import { formatAngkaEn, formatBerat, formatIdrEn, formatKurs, formatUsd, formatUsdAngka } from "@/lib/ekspor/hitung";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Export invoice", robots: { index: false } };

// B-EKSIM1: Commercial Invoice + Packing List untuk pembeli luar negeri, selalu berbahasa Inggris (dokumen mengikuti bahasa
// penerima, sama dengan keputusan /i dan cetak surat yang berbahasa Indonesia untuk penerima di Indonesia). Dua lembar A4.
// Dibaca lewat RLS pengguna (pemilik, admin, akuntan). Bukan PEB: deklarasi ekspor diajukan terpisah lewat CEISA.

type Baris = { uraian: string; hs: string | null; jumlah: number; satuan: string; harga_usd: number; nilai_usd: number; berat_bersih_kg: number; berat_kotor_kg: number; koli: number };
type Ekspor = {
  nomor: string; alamat_penjual: string; pembeli: string; alamat_pembeli: string; negara: string; incoterm: string; tempat_incoterm: string;
  pelabuhan_muat: string | null; pelabuhan_tujuan: string | null; baris: Baris[]; total_usd: number; kurs: number; kurs_sumber: string;
  kurs_tanggal: string; total_rupiah: number; berat_bersih_kg: number; berat_kotor_kg: number; koli: number; tanggal: string; jatuh_tempo: string;
  catatan: string | null; status: "terbit" | "batal"; perusahaan: { nama: string } | null;
};

const BULAN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const tanggalEn = (t: string) => { const [y, m, d] = t.split("-").map(Number); return `${d} ${BULAN[m - 1]} ${y}`; };
const sen = (usd: number) => Math.round(Number(usd) * 100);

function Kepala({ e, judul }: { e: Ekspor; judul: string }) {
  return (
    <>
      <header className="flex items-start justify-between gap-6 border-b-2 border-tinta pb-3">
        <div>
          <p className="font-judul text-2xl font-extrabold">{e.perusahaan?.nama}</p>
          <p className="mt-1 whitespace-pre-line text-sm">{e.alamat_penjual}</p>
          <p className="text-sm">Indonesia</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold uppercase tracking-wide">{judul}</h1>
          <p className="mt-1 font-mono text-sm">No. {e.nomor}</p>
          <p className="text-sm">Date: {tanggalEn(e.tanggal)}</p>
        </div>
      </header>
      {e.status === "batal" && (
        <p className="mt-4 border border-cap px-3 py-2 text-center text-sm font-semibold text-cap" data-testid="ekspor-batal">This invoice has been cancelled and is no longer valid.</p>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div className="row-span-3"><dt className="font-semibold">Buyer (consignee)</dt><dd>{e.pembeli}<br /><span className="whitespace-pre-line">{e.alamat_pembeli}</span><br />{e.negara}</dd></div>
        <div><dt className="font-semibold">Terms of delivery</dt><dd>{e.incoterm} {e.tempat_incoterm} (Incoterms 2020)</dd></div>
        <div><dt className="font-semibold">Port of loading / discharge</dt><dd>{e.pelabuhan_muat ?? "-"} / {e.pelabuhan_tujuan ?? "-"}</dd></div>
        <div><dt className="font-semibold">Country of origin</dt><dd>Indonesia</dd></div>
      </dl>
    </>
  );
}

async function Lembar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).ekspor;
  const supabase = await createClient();
  const { data } = await supabase.from("invoice_ekspor")
    .select("nomor, alamat_penjual, pembeli, alamat_pembeli, negara, incoterm, tempat_incoterm, pelabuhan_muat, pelabuhan_tujuan, baris, total_usd, kurs, kurs_sumber, kurs_tanggal, total_rupiah, berat_bersih_kg, berat_kotor_kg, koli, tanggal, jatuh_tempo, catatan, status, perusahaan:perusahaan_id(nama)")
    .eq("id", id).maybeSingle();
  const e = data as unknown as Ekspor | null;
  const alat = (
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden" lang={bahasa}>
      <a href="/app/ekspor" className="text-sm underline underline-offset-4">{t.kembali}</a>
      {e ? <TombolCetak label={t.cetakTombol} /> : null}
    </div>
  );
  if (!e) return <>{alat}<p className="p-8 text-tinta-2" lang={bahasa}>{t.tidakDitemukan}</p></>;
  const lembar = "lembar mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-kertas px-[18mm] py-[16mm] text-tinta print:min-h-0 print:p-0";
  return (
    <>
      {alat}
      <div lang="en">
        <article className={lembar} data-testid="lembar-invoice-ekspor">
          <Kepala e={e} judul="Commercial invoice" />
          <table className="mt-6 w-full text-sm">
            <caption className="sr-only">Goods invoiced</caption>
            <thead>
              <tr className="border-y border-tinta text-left">
                <th scope="col" className="py-1.5 pr-2">No.</th><th scope="col" className="py-1.5 pr-2">Description of goods</th><th scope="col" className="py-1.5 pr-2">HS code</th>
                <th scope="col" className="py-1.5 pr-2 text-right">Quantity</th><th scope="col" className="py-1.5 pr-2 text-right">Unit price (USD)</th><th scope="col" className="py-1.5 text-right">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {e.baris.map((b, i) => (
                <tr key={i} className="border-b border-garis align-top">
                  <td className="py-1.5 pr-2">{i + 1}</td><td className="py-1.5 pr-2">{b.uraian}</td><td className="py-1.5 pr-2 font-mono">{b.hs ?? "-"}</td>
                  <td className="angka py-1.5 pr-2 text-right">{formatAngkaEn(Number(b.jumlah))} {b.satuan}</td>
                  <td className="angka py-1.5 pr-2 text-right">{formatUsdAngka(Number(b.harga_usd))}</td>
                  <td className="angka py-1.5 text-right">{formatUsdAngka(Number(b.nilai_usd))}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-tinta font-bold">
                <td colSpan={5} className="py-2 pr-2 text-right">Total {e.incoterm} {e.tempat_incoterm}</td>
                <td className="angka py-2 text-right" data-testid="total-usd-cetak">{formatUsd(sen(e.total_usd))}</td>
              </tr>
            </tbody>
          </table>
          <dl className="mt-5 grid gap-2 text-sm">
            <div><dt className="inline font-semibold">Payment due: </dt><dd className="inline">{tanggalEn(e.jatuh_tempo)}</dd></div>
            {e.catatan && <div><dt className="inline font-semibold">Note: </dt><dd className="inline">{e.catatan}</dd></div>}
            <div data-testid="kurs-cetak"><dt className="inline font-semibold">Exporter&apos;s rupiah record: </dt>
              <dd className="inline">{formatIdrEn(Number(e.total_rupiah))} at {formatKurs(Number(e.kurs), "en")} per USD, rate of {tanggalEn(e.kurs_tanggal)} ({e.kurs_sumber})</dd></div>
          </dl>
          <div className="mt-12 ml-auto w-64">
            <p>For {e.perusahaan?.nama}</p>
            <div className="h-20" aria-hidden />
            <p className="border-t border-tinta pt-1 text-sm text-tinta-2">Authorized signature</p>
          </div>
          <p className="mt-auto border-t border-garis pt-3 text-xs text-tinta-2">The export declaration (PEB) is lodged separately with Indonesian Customs. HS codes are stated by the exporter.</p>
        </article>
        <article className={`${lembar} mt-6 break-before-page print:mt-0`} data-testid="lembar-packing-list">
          <Kepala e={e} judul="Packing list" />
          <table className="mt-6 w-full text-sm">
            <caption className="sr-only">Packages, net and gross weight</caption>
            <thead>
              <tr className="border-y border-tinta text-left">
                <th scope="col" className="py-1.5 pr-2">No.</th><th scope="col" className="py-1.5 pr-2">Description of goods</th><th scope="col" className="py-1.5 pr-2 text-right">Quantity</th>
                <th scope="col" className="py-1.5 pr-2 text-right">Packages</th><th scope="col" className="py-1.5 pr-2 text-right">Net weight (kg)</th><th scope="col" className="py-1.5 text-right">Gross weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              {e.baris.map((b, i) => (
                <tr key={i} className="border-b border-garis align-top">
                  <td className="py-1.5 pr-2">{i + 1}</td><td className="py-1.5 pr-2">{b.uraian}</td>
                  <td className="angka py-1.5 pr-2 text-right">{formatAngkaEn(Number(b.jumlah))} {b.satuan}</td>
                  <td className="angka py-1.5 pr-2 text-right">{b.koli}</td>
                  <td className="angka py-1.5 pr-2 text-right">{formatBerat(Number(b.berat_bersih_kg))}</td>
                  <td className="angka py-1.5 text-right">{formatBerat(Number(b.berat_kotor_kg))}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-tinta font-bold" data-testid="total-packing">
                <td colSpan={3} className="py-2 pr-2 text-right">Total</td>
                <td className="angka py-2 pr-2 text-right">{e.koli}</td>
                <td className="angka py-2 pr-2 text-right">{formatBerat(Number(e.berat_bersih_kg))}</td>
                <td className="angka py-2 text-right">{formatBerat(Number(e.berat_kotor_kg))}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-12 ml-auto w-64">
            <p>For {e.perusahaan?.nama}</p>
            <div className="h-20" aria-hidden />
            <p className="border-t border-tinta pt-1 text-sm text-tinta-2">Authorized signature</p>
          </div>
        </article>
      </div>
    </>
  );
}

export default function CetakEkspor(props: PageProps<"/cetak/ekspor/[id]">) {
  return (
    <main className="min-h-svh bg-kertas-2 py-6 print:bg-kertas print:py-0">
      <style>{"@page { size: A4; margin: 16mm 18mm; }"}</style>
      <Suspense fallback={<div className="mx-auto h-[297mm] max-w-[210mm] animate-pulse bg-kertas" aria-hidden />}>
        <Lembar params={props.params} />
      </Suspense>
    </main>
  );
}
