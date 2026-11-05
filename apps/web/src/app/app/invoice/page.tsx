import type { Metadata } from "next";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormRetur } from "@/components/app/jual";
import { TagihanBerulang } from "@/app/app/invoice/berulang";
import { CocokMutasi, FormBatalInvoice, FormBayar, FormInvoice, FormLunas, TombolPengingat, type ProdukPilihan } from "@/components/app/invoice";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { tautanWa, teksKirim, teksPengingat, type Tahap, type Umur } from "@/lib/invoice/tagihan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { asalTautan } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Invoice" };

// F4-05 (docs/research/invoice.md): invoice bernomor yang menagih sendiri lewat pengingat bertahap; pemilik yang mengirim.

type Invoice = {
  id: string; nomor: string; pelanggan: string; pelanggan_hp: string | null; total: number; tanggal: string; jatuh_tempo: string;
  status: "terbit" | "lunas" | "batal"; kode_verifikasi: string; lunas_tanggal: string | null; lunas_cara: string | null; alasan_batal: string | null;
};
type Pengingat = { id: string; tahap: Tahap; invoice: string; nomor: string; pelanggan: string; hp: string | null; total: number; jatuh_tempo: string; kode: string };
type Ringkasan = { hari: string; umur: Partial<Record<Umur, { n: number; total: number }>>; pengingat: Pengingat[] };

const URUT_UMUR: Umur[] = ["belum", "1-30", "31-60", "61-90", "90+"];
const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.invoice;
  const f = kamus.invoiceForm;
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const TAHAP: Record<Tahap, string> = { 1: t.tahap1, 2: t.tahap2, 3: t.tahap3, 4: t.tahap4 };
  const CARA: Record<string, string> = { qris: t.caraQris, transfer: t.caraTransfer, tunai: t.caraTunai };
  const LABEL_UMUR: Record<Umur, string> = { belum: t.umurBelum, "1-30": t.umur1, "31-60": t.umur31, "61-90": t.umur61, "90+": t.umur90 };
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/invoice" judul={t.judul} ket={t.ket} />
      {bahasa !== "id" ? <p className="mt-1 text-sm text-tinta-2">{t.catatanPelanggan}</p> : null}
      <p className="mt-2 text-sm"><a href="/app/ekspor" className="underline underline-offset-4" data-testid="tautan-ekspor">{kamus.ekspor.tautanEkspor}</a></p>
    </>
  );
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  }
  const supabase = await createClient();
  const [ring, inv, bayar, usaha, zona, h, produk] = await Promise.all([
    supabase.rpc("ringkasan_invoice"),
    supabase.from("invoice").select("id, nomor, pelanggan, pelanggan_hp, total, tanggal, jatuh_tempo, status, kode_verifikasi, lunas_tanggal, lunas_cara, alasan_batal, baris")
      .order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("bayar_usaha").select("qris, qris_nama, rekening").maybeSingle(),
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).single(),
    zonaUsahaIni(sesi.perusahaanId),
    headers(),
    supabase.from("produk").select("id, nama, harga_jual, jenis, harga_tingkat").eq("aktif", true).order("nama").limit(500),
  ]);
  if (ring.error || inv.error) return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-cap">{t.gagalMuat}</p></div>;
  const r = ring.data as Ringkasan;
  const daftar = (inv.data ?? []) as Invoice[];
  const b = bayar.data as { qris: string | null; qris_nama: string | null; rekening: string | null } | null;
  const namaUsaha = (usaha.data?.nama as string | undefined) ?? "usaha kami";
  const asal = asalTautan(h);
  const hari = hariIni(new Date(), zona);
  const tautan = (kode: string) => `${asal}/i/${kode}`;
  const adaUmur = URUT_UMUR.some((k) => r.umur[k]);
  const totalPiutang = URUT_UMUR.reduce((t, k) => t + Number(r.umur[k]?.total ?? 0), 0);
  const tujuan = (
    <section className="mt-8" aria-labelledby="judul-bayar">
      <h2 id="judul-bayar" className="text-lg font-semibold">{t.tujuanJudul}</h2>
      {!b && <p className="mt-1 text-sm text-tinta-2">{t.tujuanBelum}</p>}
      {sesi.peran === "pemilik" ? <FormBayar awal={{ qris: b?.qris ?? null, qris_nama: b?.qris_nama ?? null, rekening: b?.rekening ?? null }} teks={f} /> : (
        <p className="mt-1 text-sm" data-testid="tujuan-bayar">{b ? <span data-pengguna>{[b.qris_nama && `QRIS ${b.qris_nama}`, b.rekening].filter(Boolean).join(". ")}</span> : t.belumDiatur}</p>
      )}
    </section>
  );

  return (
    <div lang={bahasa}>
      {kepala}
      <section className="mt-6" aria-labelledby="judul-umur" data-testid="umur-piutang">
        <h2 id="judul-umur" className="text-lg font-semibold">{t.umurJudul}</h2>
        {!adaUmur ? <p data-langkah='#judul-baru' className="mt-1 text-sm text-tinta-2">{t.umurKosong}</p> : (
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">{t.umurCaption}</caption>
            <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">{t.kolUmur}</th><th scope="col" className="py-1 text-right font-semibold">{t.kolInvoice}</th><th scope="col" className="py-1 text-right font-semibold">{t.kolJumlah}</th></tr></thead>
            <tbody>
              {URUT_UMUR.filter((k) => r.umur[k]).map((k) => (
                <tr key={k} className="border-b border-garis" data-umur={k}>
                  <td className="py-1.5">{LABEL_UMUR[k]}</td><td className="angka py-1.5 text-right">{r.umur[k]!.n}</td><td className="py-1.5 text-right"><Rupiah nilai={Number(r.umur[k]!.total)} bahasa={bahasa} /></td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">{t.total}</td><td /><td className="py-1.5 text-right"><Rupiah nilai={totalPiutang} bahasa={bahasa} /></td></tr>
            </tbody>
          </table>
        )}
      </section>

      {r.pengingat.length > 0 && (
        <section className="mt-8" aria-labelledby="judul-pengingat" data-testid="pengingat-hari-ini">
          <h2 id="judul-pengingat" className="text-lg font-semibold">{t.pengingatJudul}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.pengingatKet}</p>
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {r.pengingat.map((p) => {
              const teks = teksPengingat(p.tahap, { usaha: namaUsaha, pelanggan: p.pelanggan, nomor: p.nomor, total: Number(p.total), jatuhTempo: p.jatuh_tempo, tautan: tautan(p.kode) });
              const wa = tautanWa(p.hp, teks);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="baris-pengingat">
                  <span><span className="font-semibold" data-pengguna>{p.pelanggan}</span> <span className="font-mono text-xs">{p.nomor}</span><span className="block text-sm text-tinta-2">{TAHAP[p.tahap]}</span></span>
                  {wa ? <TombolPengingat id={p.id} href={wa} label={t.kirimPengingat} /> : <span className="text-sm text-tinta-2">{t.tanpaWa} <span className="font-mono">{tautan(p.kode)}</span></span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!b && (
        <p className="mt-6 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="bayar-belum">
          {t.bayarBelum} <a href="#judul-bayar" className="font-semibold underline underline-offset-4">{t.aturBayar}</a> {t.diBawah}
        </p>
      )}

      <section className="mt-8" aria-labelledby="judul-cocok">
        <h2 id="judul-cocok" className="text-lg font-semibold">{t.cocokJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.cocokKet}</p>
        <CocokMutasi teks={f} bahasa={bahasa} />
      </section>

      <section className="mt-8" aria-labelledby="judul-baru">
        <h2 id="judul-baru" className="text-lg font-semibold">{t.baruJudul}</h2>
        <FormInvoice kunci={randomUUID()} jatuhTempo={geser(hari, 14)} hariIni={hari} teks={f} bahasa={bahasa} produk={(produk.data ?? []) as ProdukPilihan[]} />
      </section>

      {sesi.peran !== "akuntan" && <TagihanBerulang bahasa={bahasa} hariIni={hari} />}

      <section className="mt-8" aria-labelledby="judul-daftar">
        <h2 id="judul-daftar" className="text-lg font-semibold">{t.daftarJudul}</h2>
        {daftar.length === 0 ? <p className="mt-1 text-sm text-tinta-2" data-testid="invoice-kosong">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-invoice">
            {daftar.map((i) => {
              const wa = i.status === "terbit" ? tautanWa(i.pelanggan_hp, teksKirim({ usaha: namaUsaha, pelanggan: i.pelanggan, nomor: i.nomor, total: Number(i.total), jatuhTempo: i.jatuh_tempo, tautan: tautan(i.kode_verifikasi) })) : null;
              return (
                <li key={i.id} className="grid gap-2 py-3" data-testid="baris-daftar-invoice" data-nomor={i.nomor}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold"><span data-pengguna>{i.pelanggan}</span> <span className="font-mono text-xs font-normal">{i.nomor}</span></p>
                      <p className="text-sm text-tinta-2">
                        {i.status === "lunas" ? isiTeks(t.lunasLewat, { tanggal: tgl(i.lunas_tanggal!), cara: CARA[i.lunas_cara ?? ""] ?? i.lunas_cara ?? "" }) : i.status === "batal" ? <>{t.dibatalkan} <span data-pengguna>{i.alasan_batal}</span></> : isiTeks(t.jatuhTempo, { tanggal: tgl(i.jatuh_tempo) })}
                      </p>
                    </div>
                    <div className="text-right">
                      <Rupiah nilai={Number(i.total)} className="font-semibold" bahasa={bahasa} />
                      <div className="mt-1">{i.status === "lunas" ? <Cap jenis="lunas" label={kamus.cap.lunas} /> : i.status === "batal" ? <Cap jenis="ditolak" label={t.batal} /> : <Cap jenis="menunggu" label={t.belumDibayar} />}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <a href={`/i/${i.kode_verifikasi}`} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer" hrefLang="id">{t.lihatHalaman}</a>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-testid="kirim-invoice">{t.kirimWa}</a>}
                  </div>
                  {i.status === "terbit" && <FormLunas invoice={i.id} hariIni={hari} label={i.nomor} teks={f} />}
                  {i.status === "terbit" && <FormBatalInvoice invoice={i.id} label={i.nomor} teks={f} />}
                  {i.status !== "batal" && <FormRetur invoice={i.id} baris={(i as unknown as { baris: { uraian: string; jumlah: number }[] }).baris ?? []} kunci={randomUUID()} teks={ambilKamus(bahasa).jual} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tujuan}
    </div>
  );
}

export default function HalamanInvoice() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
