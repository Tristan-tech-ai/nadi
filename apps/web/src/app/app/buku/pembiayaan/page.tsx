import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { TombolCetak } from "@/components/app/buku";
import { Rupiah } from "@/components/ui/rupiah";
import { rentang12Bulan, riwayatInvoice, type InvoiceRingkas } from "@/lib/buku/pembiayaan";
import type { Laporan, UmurPiutang } from "@/lib/buku/laporan";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { LangkahPertama } from "@/components/app/langkah-pertama";

export const metadata: Metadata = { title: "Paket pembiayaan" };

const sel = "border-b border-garis py-2 pr-3";
const kanan = `${sel} text-right`;

function Tabel({ label, kepala, children }: { label: string; kepala: string[]; children: ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[32rem] text-left text-sm print:min-w-0">
        <thead className="text-tinta-2"><tr>{kepala.map((k, i) => <th key={k} scope="col" className={i === 0 ? sel : kanan}>{k}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).pembiayaan;
  const kel = ambilKamus(bahasa).buku.kel;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/buku/pembiayaan" judul={t.judul} ket={t.hanyaPengelola} /></div>;
  }
  const supabase = await createClient();
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const r = rentang12Bulan(hari);
  const [lap, umur, inv, usaha, ...perBulan] = await Promise.all([
    supabase.rpc("laporan_keuangan", { p_dari: r.dari, p_sampai: r.sampai }),
    supabase.rpc("umur_piutang", { p_per: r.sampai }),
    supabase.from("invoice").select("tanggal, total, status, lunas_tanggal").gte("tanggal", r.dari).lte("tanggal", r.sampai).limit(5000),
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).maybeSingle(),
    ...r.bulan.map((b) => supabase.rpc("laporan_keuangan", { p_dari: b.dari, p_sampai: b.sampai })),
  ]);
  const L = lap.data as Laporan | null;
  const U = umur.data as UmurPiutang | null;
  const riwayat = riwayatInvoice((inv.data ?? []) as InvoiceRingkas[], r.bulan);
  const namaBulan = (kode: string) => {
    const [th, bl] = kode.split("-").map(Number);
    return new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(th, bl - 1, 1)));
  };
  const rp = (n: number) => <Rupiah nilai={n} bahasa={bahasa} />;
  const kosong = !L || L.neraca_saldo.length === 0;

  return (
    <div lang={bahasa}>
      <p className="text-sm print:hidden"><Link href="/app/buku" className="text-laut underline underline-offset-2">{t.kembali}</Link></p>
      <header className="mt-3">
        <p className="text-sm text-tinta-2" data-pengguna>{usaha.data?.nama as string}</p>
        <KepalaHalaman jalur="/app/buku/pembiayaan" judul={t.judul} ket={<span data-testid="periode" data-dari={r.dari} data-sampai={r.sampai}>{isiTeks(t.periode, { dari: formatTanggalKalender(r.dari, bahasa), sampai: formatTanggalKalender(r.sampai, bahasa) })}</span>} />
        <p className="mt-2 max-w-2xl text-sm">{t.ket}</p>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden"><TombolCetak label={t.cetak} /><p className="text-sm text-tinta-2">{t.kirimSendiri}</p></div>
      {kosong && <p className="mt-6 text-sm text-tinta-2" data-testid="pembiayaan-kosong">{t.kosong}</p>}

      {L && (<>
        <section className="mt-8 break-inside-avoid" aria-labelledby="pb-ringkas">
          <h2 id="pb-ringkas" className="text-lg font-semibold">{t.ringkasJudul}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="pembiayaan-ringkas">
            {([[t.pendapatan, L.laba_rugi.pendapatan, "pb-pendapatan"], [t.beban, L.laba_rugi.beban, "pb-beban"], [L.laba_rugi.laba >= 0 ? t.laba : t.rugi, L.laba_rugi.laba, "pb-laba"],
              [t.kasAkhir, L.arus_kas.kas_akhir, "pb-kas"]] as const).map(([k, v, id]) => (
              <div key={id} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4 print:border print:border-garis"><dt className="text-sm text-tinta-2">{k}</dt><dd className="mt-1 text-xl font-semibold" data-testid={id}>{rp(v)}</dd></div>
            ))}
          </dl>
        </section>

        <section className="mt-8 break-inside-avoid" aria-labelledby="pb-bulan">
          <h2 id="pb-bulan" className="text-lg font-semibold">{t.perBulanJudul}</h2>
          <Tabel label={t.perBulanJudul} kepala={[t.kolBulan, t.pendapatan, t.beban, t.kolLaba]}>
            {r.bulan.map((b, i) => {
              const x = perBulan[i].data as Laporan | null;
              return <tr key={b.bulan} data-testid="pb-baris-bulan"><td className={sel}>{namaBulan(b.bulan)}</td><td className={`${kanan} angka`}>{rp(x?.laba_rugi.pendapatan ?? 0)}</td>
                <td className={`${kanan} angka`}>{rp(x?.laba_rugi.beban ?? 0)}</td><td className={`${kanan} angka`}>{rp(x?.laba_rugi.laba ?? 0)}</td></tr>;
            })}
          </Tabel>
        </section>

        <section className="mt-8 break-inside-avoid" aria-labelledby="pb-neraca">
          <h2 id="pb-neraca" className="text-lg font-semibold">{isiTeks(t.neracaJudul, { per: formatTanggalKalender(r.sampai, bahasa) })}</h2>
          <dl className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="pb-neraca">
            {([[t.aset, L.neraca.aset], [t.kewajiban, L.neraca.kewajiban], [t.modal, L.neraca.modal + L.neraca.laba_belum_ditutup]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2"><dt>{k}</dt><dd>{rp(v)}</dd></div>))}
          </dl>
          <p className={`mt-2 text-sm ${L.neraca.seimbang ? "text-daun" : "text-cap"}`}>{L.neraca.seimbang ? t.seimbang : t.tidakSeimbang}</p>
        </section>

        <section className="mt-8 break-inside-avoid" aria-labelledby="pb-kas">
          <h2 id="pb-kas" className="text-lg font-semibold">{t.arusJudul}</h2>
          <dl className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="pb-arus">
            {([[t.kasAwal, L.arus_kas.kas_awal], [t.operasi, L.arus_kas.operasi], [t.investasi, L.arus_kas.investasi], [t.pendanaan, L.arus_kas.pendanaan], [t.kasAkhir, L.arus_kas.kas_akhir]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2"><dt>{k}</dt><dd>{rp(v)}</dd></div>))}
          </dl>
        </section>
      </>)}

      {U && (
        <section className="mt-8 break-inside-avoid" aria-labelledby="pb-umur">
          <h2 id="pb-umur" className="text-lg font-semibold">{isiTeks(t.umurJudul, { per: formatTanggalKalender(r.sampai, bahasa) })}</h2>
          <dl className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="pb-umur">
            {(["belum", "h1_30", "h31_60", "h61_90", "lebih_90", "total"] as const).map((k) => (
              <div key={k} className={`flex justify-between py-2 ${k === "total" ? "font-semibold" : ""}`}><dt>{kel[k]}</dt><dd data-testid={`pb-umur-${k}`}>{rp(U.kelompok[k] ?? 0)}</dd></div>))}
          </dl>
        </section>
      )}

      <section className="mt-8 break-inside-avoid" aria-labelledby="pb-invoice">
        <h2 id="pb-invoice" className="text-lg font-semibold">{t.invoiceJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2" data-testid="pb-hari-bayar">{riwayat.rataHariBayar === null ? <>{t.belumAdaLunas} <LangkahPertama href="/app/invoice">{t.langkahKosong}</LangkahPertama></> : isiTeks(t.rataBayar, { hari: riwayat.rataHariBayar.toLocaleString(bahasa === "en" ? "en-US" : "id-ID"), n: riwayat.tepat })}</p>
        <Tabel label={t.invoiceJudul} kepala={[t.kolBulan, t.kolTerbit, t.kolNilai, t.kolLunas, t.kolNilaiLunas]}>
          {riwayat.baris.map((b) => (
            <tr key={b.bulan} data-testid="pb-baris-invoice"><td className={sel}>{namaBulan(b.bulan)}</td><td className={`${kanan} angka`}>{b.terbit}</td><td className={`${kanan} angka`}>{rp(b.nilai)}</td>
              <td className={`${kanan} angka`}>{b.lunas}</td><td className={`${kanan} angka`}>{rp(b.nilaiLunas)}</td></tr>))}
        </Tabel>
      </section>

      <p className="mt-8 max-w-2xl text-xs text-tinta-2">{isiTeks(t.catatan, { tanggal: formatTanggalKalender(hari, bahasa) })}</p>
    </div>
  );
}

export default function HalamanPembiayaan() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 print:max-w-none print:p-0">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
