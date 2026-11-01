import type { Metadata } from "next";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBatalInvoice, FormBayar, FormInvoice, FormLunas, TombolPengingat } from "@/components/app/invoice";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { LABEL_UMUR, tautanWa, teksKirim, teksPengingat, type Tahap, type Umur } from "@/lib/invoice/tagihan";
import { hariIni } from "@/lib/izin";
import { asalTautan } from "@/lib/mcp/http";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Invoice" };

// F4-05 (docs/research/invoice.md): invoice bernomor yang menagih sendiri lewat pengingat bertahap; pemilik yang mengirim.

type Invoice = {
  id: string; nomor: string; pelanggan: string; pelanggan_hp: string | null; total: number; tanggal: string; jatuh_tempo: string;
  status: "terbit" | "lunas" | "batal"; kode_verifikasi: string; lunas_tanggal: string | null; lunas_cara: string | null; alasan_batal: string | null;
};
type Pengingat = { id: string; tahap: Tahap; invoice: string; nomor: string; pelanggan: string; hp: string | null; total: number; jatuh_tempo: string; kode: string };
type Ringkasan = { hari: string; umur: Partial<Record<Umur, { n: number; total: number }>>; pengingat: Pengingat[] };

const TAHAP: Record<Tahap, string> = {
  1: "Pengingat ramah, 3 hari sebelum jatuh tempo", 2: "Jatuh tempo hari ini", 3: "Lewat 3 hari dari jatuh tempo", 4: "Lewat 14 hari, nada tegas",
};
const CARA: Record<string, string> = { qris: "QRIS", transfer: "transfer", tunai: "tunai" };
const URUT_UMUR: Umur[] = ["belum", "1-30", "31-60", "61-90", "90+"];
const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function Isi() {
  const sesi = await wajibPerusahaan();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <p className="mt-6 text-tinta-2">Invoice hanya untuk pemilik, admin, dan akuntan.</p>;
  }
  const supabase = await createClient();
  const [ring, inv, bayar, usaha, zona, h] = await Promise.all([
    supabase.rpc("ringkasan_invoice"),
    supabase.from("invoice").select("id, nomor, pelanggan, pelanggan_hp, total, tanggal, jatuh_tempo, status, kode_verifikasi, lunas_tanggal, lunas_cara, alasan_batal")
      .order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("bayar_usaha").select("qris, qris_nama, rekening").maybeSingle(),
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).single(),
    zonaUsahaIni(sesi.perusahaanId),
    headers(),
  ]);
  if (ring.error || inv.error) return <p role="alert" className="mt-6 text-cap">Invoice belum bisa dimuat. Coba muat ulang.</p>;
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
      <h2 id="judul-bayar" className="text-lg font-semibold">Tujuan bayar</h2>
      {!b && <p className="mt-1 text-sm text-tinta-2">Atur QRIS atau rekening dulu supaya halaman tagihan menunjukkan cara membayar.</p>}
      {sesi.peran === "pemilik" ? <FormBayar awal={{ qris: b?.qris ?? null, qris_nama: b?.qris_nama ?? null, rekening: b?.rekening ?? null }} /> : (
        <p className="mt-1 text-sm" data-testid="tujuan-bayar">{b ? [b.qris_nama && `QRIS ${b.qris_nama}`, b.rekening].filter(Boolean).join(". ") : "Belum diatur pemilik."}</p>
      )}
    </section>
  );

  return (
    <>
      <section className="mt-6" aria-labelledby="judul-umur" data-testid="umur-piutang">
        <h2 id="judul-umur" className="text-lg font-semibold">Tagihan belum dibayar</h2>
        {!adaUmur ? <p className="mt-1 text-sm text-tinta-2">Belum ada tagihan yang menunggu dibayar.</p> : (
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Umur tagihan belum dibayar (piutang)</caption>
            <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">Umur</th><th scope="col" className="py-1 text-right font-semibold">Invoice</th><th scope="col" className="py-1 text-right font-semibold">Jumlah</th></tr></thead>
            <tbody>
              {URUT_UMUR.filter((k) => r.umur[k]).map((k) => (
                <tr key={k} className="border-b border-garis" data-umur={k}>
                  <td className="py-1.5">{LABEL_UMUR[k]}</td><td className="angka py-1.5 text-right">{r.umur[k]!.n}</td><td className="py-1.5 text-right"><Rupiah nilai={Number(r.umur[k]!.total)} /></td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total</td><td /><td className="py-1.5 text-right"><Rupiah nilai={totalPiutang} /></td></tr>
            </tbody>
          </table>
        )}
      </section>

      {r.pengingat.length > 0 && (
        <section className="mt-8" aria-labelledby="judul-pengingat" data-testid="pengingat-hari-ini">
          <h2 id="judul-pengingat" className="text-lg font-semibold">Pengingat hari ini</h2>
          <p className="mt-1 text-sm text-tinta-2">Nadi menyiapkan pesannya; kamu yang mengirim lewat WhatsApp.</p>
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {r.pengingat.map((p) => {
              const teks = teksPengingat(p.tahap, { usaha: namaUsaha, pelanggan: p.pelanggan, nomor: p.nomor, total: Number(p.total), jatuhTempo: p.jatuh_tempo, tautan: tautan(p.kode) });
              const wa = tautanWa(p.hp, teks);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="baris-pengingat">
                  <span><span className="font-semibold">{p.pelanggan}</span> <span className="font-mono text-xs">{p.nomor}</span><span className="block text-sm text-tinta-2">{TAHAP[p.tahap]}</span></span>
                  {wa ? <TombolPengingat id={p.id} href={wa} label="Kirim pengingat" /> : <span className="text-sm text-tinta-2">Tanpa nomor WhatsApp. Tautan: <span className="font-mono">{tautan(p.kode)}</span></span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!b && (
        <p className="mt-6 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="bayar-belum">
          Halaman tagihan belum menunjukkan cara bayar. <a href="#judul-bayar" className="font-semibold underline underline-offset-4">Atur QRIS atau rekening</a> di bagian bawah.
        </p>
      )}

      <section className="mt-8" aria-labelledby="judul-baru">
        <h2 id="judul-baru" className="text-lg font-semibold">Invoice baru</h2>
        <FormInvoice kunci={randomUUID()} jatuhTempo={geser(hari, 14)} hariIni={hari} />
      </section>

      <section className="mt-8" aria-labelledby="judul-daftar">
        <h2 id="judul-daftar" className="text-lg font-semibold">Daftar invoice</h2>
        {daftar.length === 0 ? <p className="mt-1 text-sm text-tinta-2" data-testid="invoice-kosong">Belum ada invoice. Terbitkan yang pertama di atas.</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-invoice">
            {daftar.map((i) => {
              const wa = i.status === "terbit" ? tautanWa(i.pelanggan_hp, teksKirim({ usaha: namaUsaha, pelanggan: i.pelanggan, nomor: i.nomor, total: Number(i.total), jatuhTempo: i.jatuh_tempo, tautan: tautan(i.kode_verifikasi) })) : null;
              return (
                <li key={i.id} className="grid gap-2 py-3" data-testid="baris-daftar-invoice" data-nomor={i.nomor}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{i.pelanggan} <span className="font-mono text-xs font-normal">{i.nomor}</span></p>
                      <p className="text-sm text-tinta-2">
                        {i.status === "lunas" ? `Lunas ${formatTanggalKalender(i.lunas_tanggal!)} lewat ${CARA[i.lunas_cara ?? ""] ?? i.lunas_cara}` : i.status === "batal" ? `Dibatalkan: ${i.alasan_batal}` : `Jatuh tempo ${formatTanggalKalender(i.jatuh_tempo)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Rupiah nilai={Number(i.total)} className="font-semibold" />
                      <div className="mt-1">{i.status === "lunas" ? <Cap jenis="lunas" /> : i.status === "batal" ? <Cap jenis="ditolak" label="Batal" /> : <Cap jenis="menunggu" label="Belum dibayar" />}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <a href={`/i/${i.kode_verifikasi}`} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">Lihat halaman tagihan</a>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-testid="kirim-invoice">Kirim lewat WhatsApp</a>}
                  </div>
                  {i.status === "terbit" && <FormLunas invoice={i.id} hariIni={hari} label={i.nomor} />}
                  {i.status === "terbit" && <FormBatalInvoice invoice={i.id} label={i.nomor} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tujuan}
    </>
  );
}

export default function HalamanInvoice() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Invoice</h1>
      <p className="mt-1 text-sm text-tinta-2">Invoice bernomor dengan halaman bayar untuk pelanggan. Ini bukan faktur pajak.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
