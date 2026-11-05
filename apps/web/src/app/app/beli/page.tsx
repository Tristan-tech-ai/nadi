import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBayarBeli, FormDokumenBeli, FormReturBeli, FormTagihanBeli, TombolLanjutBeli } from "@/components/app/beli";
import { Rupiah } from "@/components/ui/rupiah";
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

export const metadata: Metadata = { title: "Pembelian" };

type BarisDok = { uraian: string; jumlah: number; harga: number; produk?: string };
type Dok = { id: string; jenis: "permintaan" | "pesanan_beli" | "penerimaan"; nomor: string; induk_id: string | null; pemasok: string; baris: BarisDok[]; total: number; tanggal: string; status: string };
type Tagihan = { id: string; pemasok: string; nomor_pemasok: string | null; tanggal: string; jatuh_tempo: string; total: number; terbayar: number; dikurangi: number; status: string;
  dokumen_id: string | null; selisih: number; usulan_id: string | null };
type Saldo = { pemasok: string; terbuka: number; sisa: number; jatuh_tempo: string | null };

const geser = (hari: string, n: number) => new Date(Date.parse(`${hari}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).beli;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/beli" judul={t.judul} ket={t.hanya} /></div>;
  }
  const ubah = sesi.peran !== "akuntan";
  const supabase = await createClient();
  const [dok, tagihan, saldo, produk, zona] = await Promise.all([
    supabase.from("dokumen_beli").select("id, jenis, nomor, induk_id, pemasok, baris, total, tanggal, status").order("dibuat_at", { ascending: false }).limit(60),
    supabase.from("tagihan_beli").select("id, pemasok, nomor_pemasok, tanggal, jatuh_tempo, total, terbayar, dikurangi, status, dokumen_id, selisih, usulan_id")
      .order("jatuh_tempo", { ascending: true }).limit(200),
    ubah ? supabase.rpc("saldo_pemasok") : Promise.resolve({ data: [] }),
    supabase.from("produk").select("id, nama").eq("aktif", true).eq("jenis", "barang").order("nama").limit(500),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const hari = hariIni(new Date(), zona);
  const daftar = (dok.data ?? []) as Dok[];
  const semuaTagihan = (tagihan.data ?? []) as Tagihan[];
  const ditagih = new Set(semuaTagihan.map((x) => x.dokumen_id).filter(Boolean));
  const terbuka = semuaTagihan.filter((x) => x.status === "terbuka");
  const dokPer = new Map(daftar.map((d) => [d.id, d]));
  const saldoDaftar = ((saldo.data ?? []) as Saldo[]).filter((s) => s.terbuka > 0);
  const totalHutang = terbuka.reduce((a, x) => a + x.total - x.terbayar - x.dikurangi, 0);

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/beli" judul={t.judul} ket={t.ket} />

      <section className="mt-6" aria-labelledby="judul-hutang">
        <h2 id="judul-hutang" className="text-lg font-semibold">{t.tagihanJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.totalHutang} <span className="font-semibold text-tinta" data-testid="total-hutang"><Rupiah nilai={totalHutang} bahasa={bahasa} /></span></p>
        {terbuka.length === 0 ? <p className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2">{t.tagihanKosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {terbuka.map((x) => {
              const sisa = x.total - x.terbayar - x.dikurangi;
              const lewat = x.jatuh_tempo < hari;
              const grn = x.dokumen_id ? dokPer.get(x.dokumen_id) : undefined;
              const barang = (grn?.baris ?? []).filter((b) => b.produk).map((b) => ({ produk: b.produk!, uraian: b.uraian, harga: Number(b.harga) }));
              return (
                <li key={x.id} className="grid gap-2 py-3 text-sm" data-testid="baris-tagihan-beli" data-pemasok={x.pemasok}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p><span className="font-semibold" data-pengguna>{x.pemasok}</span>{x.nomor_pemasok ? <> · <span className="font-mono" data-pengguna>{x.nomor_pemasok}</span></> : null}
                      {grn ? <> · <span className="font-mono">{grn.nomor}</span></> : null}{x.usulan_id ? <> · {t.dariLempar}</> : null}</p>
                    <p className="font-semibold">{t.sisa} <Rupiah nilai={sisa} bahasa={bahasa} /></p>
                  </div>
                  <p className="text-tinta-2">{t.total} <Rupiah nilai={x.total} bahasa={bahasa} />
                    {x.terbayar > 0 ? <> · {t.terbayar} <Rupiah nilai={x.terbayar} bahasa={bahasa} /></> : null}
                    {x.dikurangi > 0 ? <> · {t.dikurangi} <Rupiah nilai={x.dikurangi} bahasa={bahasa} /></> : null}
                    {x.selisih !== 0 ? <> · {t.selisihPo} <Rupiah nilai={x.selisih} bahasa={bahasa} /></> : null}
                    {" · "}<span className={lewat ? "font-semibold text-cap" : undefined}>{isiTeks(lewat ? t.lewatTempo : t.jatuhTempoPada, { tanggal: formatTanggalKalender(x.jatuh_tempo, bahasa) })}</span></p>
                  {ubah && (
                    <div className="flex flex-wrap items-end gap-3">
                      <FormBayarBeli tagihan={x.id} sisa={sisa} kunci={randomUUID()} teks={t} />
                      {barang.length > 0 && <FormReturBeli tagihan={x.id} barang={barang} kunci={randomUUID()} teks={t} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {ubah && (
        <section className="mt-8" aria-labelledby="judul-baru"><h2 id="judul-baru" className="text-lg font-semibold">{t.baru}</h2>
          <FormDokumenBeli kunci={randomUUID()} produk={(produk.data ?? []) as { id: string; nama: string }[]} teks={t} /></section>
      )}

      <section className="mt-8" aria-labelledby="judul-dok">
        <h2 id="judul-dok" className="text-lg font-semibold">{t.daftar}</h2>
        {daftar.length === 0 ? <p data-langkah='#judul-baru' className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {daftar.map((d) => (
              <li key={d.id} className="grid gap-2 py-3 text-sm" data-testid="baris-dokumen-beli" data-jenis={d.jenis} data-pemasok={d.pemasok}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><span className="font-semibold">{t.jenisNama[d.jenis]}</span> <span className="font-mono">{d.nomor}</span> · <span data-pengguna>{d.pemasok}</span></p>
                  <p className="font-semibold"><Rupiah nilai={d.total} bahasa={bahasa} /></p>
                </div>
                <p className="text-tinta-2">{formatTanggalKalender(d.tanggal, bahasa)} · {d.jenis === "penerimaan" ? (ditagih.has(d.id) ? t.sudahDitagih : t.belumDitagih)
                  : (t.statusNama[d.status as keyof typeof t.statusNama] ?? d.status)}</p>
                {ubah && (
                  <div className="flex flex-wrap items-end gap-3">
                    <a href={`/cetak/beli/${d.id}`} className="text-sm underline underline-offset-4">{t.cetak}</a>
                    {d.jenis === "permintaan" && d.status === "terbit" && <TombolLanjutBeli induk={d.id} jenis="pesanan_beli" label={t.jadikanPo} kunci={randomUUID()} />}
                    {d.jenis === "pesanan_beli" && d.status === "terbit" && <TombolLanjutBeli induk={d.id} jenis="penerimaan" label={t.terimaBarang} kunci={randomUUID()} />}
                    {d.jenis === "penerimaan" && !ditagih.has(d.id) && <FormTagihanBeli dokumen={d.id} total={d.total} hari={hari} jatuhTempo={geser(hari, 30)} kunci={randomUUID()} teks={t} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ubah && (
        <section className="mt-8" aria-labelledby="judul-manual"><h2 id="judul-manual" className="text-lg font-semibold">{t.tagihanManual}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.tagihanManualKet}</p>
          <FormTagihanBeli hari={hari} jatuhTempo={geser(hari, 30)} kunci={randomUUID()} teks={t} /></section>
      )}

      {ubah && (
        <section className="mt-8" aria-labelledby="judul-saldo">
          <h2 id="judul-saldo" className="text-lg font-semibold">{t.saldoJudul}</h2>
          {saldoDaftar.length === 0 ? <p data-langkah='#judul-manual' className="mt-2 text-sm text-tinta-2">{t.saldoKosong}</p> : (
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={t.saldoJudul}>
              <table className="w-full border-y border-garis text-sm" data-testid="saldo-pemasok">
                <thead><tr className="border-b border-garis text-left text-tinta-2"><th scope="col" className="py-2 pr-3 font-medium">{t.pemasok}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t.terbuka}</th><th scope="col" className="py-2 text-right font-medium">{t.sisa}</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">{t.jatuhTempoTerdekat}</th></tr></thead>
                <tbody className="divide-y divide-garis">
                  {saldoDaftar.map((s) => <tr key={s.pemasok}><td className="py-2 pr-3" data-pengguna>{s.pemasok}</td><td className="angka py-2 text-right">{s.terbuka}</td>
                    <td className="py-2 text-right"><Rupiah nilai={s.sisa} bahasa={bahasa} /></td>
                    <td className="py-2 pl-3 text-right">{s.jatuh_tempo ? formatTanggalKalender(s.jatuh_tempo, bahasa) : ""}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function Beli() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
