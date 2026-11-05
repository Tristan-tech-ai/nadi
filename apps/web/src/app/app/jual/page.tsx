import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormDokumen, FormTagih, FormUangMuka, TombolLanjut } from "@/components/app/jual";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Penjualan" };

type Dok = { id: string; jenis: "penawaran" | "pesanan" | "surat_jalan"; nomor: string; induk_id: string | null; pelanggan: string; total: number; tanggal: string;
  uang_muka: number; persen_ditagih: number; status: string };
type Saldo = { pelanggan: string; terbuka: number; sisa: number; penjualan_12_bulan: number };

const geser = (hari: string, n: number) => new Date(Date.parse(`${hari}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).jual;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/jual" judul={t.judul} ket={t.hanya} /></div>;
  }
  const supabase = await createClient();
  const [dok, saldo, produk, zona] = await Promise.all([
    supabase.from("dokumen_jual").select("id, jenis, nomor, induk_id, pelanggan, total, tanggal, uang_muka, persen_ditagih, status").order("dibuat_at", { ascending: false }).limit(60),
    supabase.rpc("saldo_pelanggan"),
    supabase.from("produk").select("id, nama, harga_jual").eq("aktif", true).order("nama").limit(500),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const hari = hariIni(new Date(), zona);
  const daftar = (dok.data ?? []) as Dok[];
  const saldoDaftar = ((saldo.data ?? []) as Saldo[]).filter((s) => s.terbuka > 0 || s.penjualan_12_bulan > 0);

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/jual" judul={t.judul} ket={t.ket} />

      <section className="mt-6" aria-labelledby="judul-baru"><h2 id="judul-baru" className="text-lg font-semibold">{t.baru}</h2>
        <FormDokumen kunci={randomUUID()} produk={(produk.data ?? []) as { id: string; nama: string; harga_jual: number }[]} teks={t} /></section>

      <section className="mt-8" aria-labelledby="judul-dok">
        <h2 id="judul-dok" className="text-lg font-semibold">{t.daftar}</h2>
        {daftar.length === 0 ? <p data-langkah='#judul-baru' className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="jual-kosong">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {daftar.map((d) => (
              <li key={d.id} className="grid gap-2 py-3 text-sm" data-testid="baris-dokumen-jual" data-jenis={d.jenis} data-pelanggan={d.pelanggan}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><span className="font-semibold">{t.jenisNama[d.jenis]}</span> <span className="font-mono">{d.nomor}</span> · <span data-pengguna>{d.pelanggan}</span></p>
                  <p className="font-semibold"><Rupiah nilai={d.total} bahasa={bahasa} /></p>
                </div>
                <p className="text-tinta-2">{formatTanggalKalender(d.tanggal, bahasa)} · {t.statusNama[d.status as keyof typeof t.statusNama] ?? d.status}
                  {d.uang_muka > 0 ? <> · {t.uangMuka} <Rupiah nilai={d.uang_muka} bahasa={bahasa} /></> : null}
                  {d.persen_ditagih > 0 ? <> · {t.ditagih} {Number(d.persen_ditagih)}%</> : null}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <a href={`/cetak/jual/${d.id}`} className="text-sm underline underline-offset-4">{t.cetak}</a>
                  {d.jenis === "penawaran" && <a href={`/cetak/jual/${d.id}?proforma=1`} className="text-sm underline underline-offset-4">{t.cetakProforma}</a>}
                  {d.jenis === "penawaran" && d.status === "terbit" && <TombolLanjut induk={d.id} jenis="pesanan" label={t.jadikanPesanan} kunci={randomUUID()} />}
                  {d.jenis === "pesanan" && d.status === "terbit" && (
                    <>
                      <FormUangMuka pesanan={d.id} kunci={randomUUID()} teks={t} />
                      <TombolLanjut induk={d.id} jenis="surat_jalan" label={t.buatSuratJalan} kunci={randomUUID()} />
                      <FormTagih dokumen={d.id} sisaPersen={100 - Number(d.persen_ditagih)} jatuhTempo={geser(hari, 14)} kunci={randomUUID()} teks={t} />
                    </>
                  )}
                  {d.jenis === "surat_jalan" && d.status === "terbit" && <FormTagih dokumen={d.id} sisaPersen={100} jatuhTempo={geser(hari, 14)} kunci={randomUUID()} teks={t} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="judul-saldo">
        <h2 id="judul-saldo" className="text-lg font-semibold">{t.saldoJudul}</h2>
        {saldoDaftar.length === 0 ? <p data-langkah='#judul-baru' className="mt-2 text-sm text-tinta-2">{t.saldoKosong}</p> : (
          <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={t.saldoJudul}>
            <table className="w-full border-y border-garis text-sm" data-testid="saldo-pelanggan">
              <thead><tr className="border-b border-garis text-left text-tinta-2"><th scope="col" className="py-2 pr-3 font-medium">{t.pelanggan}</th>
                <th scope="col" className="py-2 text-right font-medium">{t.terbuka}</th><th scope="col" className="py-2 text-right font-medium">{t.sisa}</th><th scope="col" className="py-2 text-right font-medium">{t.penjualan12}</th></tr></thead>
              <tbody className="divide-y divide-garis">
                {saldoDaftar.map((s) => <tr key={s.pelanggan}><td className="py-2 pr-3" data-pengguna>{s.pelanggan}</td><td className="angka py-2 text-right">{s.terbuka}</td>
                  <td className="py-2 text-right"><Rupiah nilai={s.sisa} bahasa={bahasa} /></td><td className="py-2 text-right"><Rupiah nilai={s.penjualan_12_bulan} bahasa={bahasa} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Jual() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
