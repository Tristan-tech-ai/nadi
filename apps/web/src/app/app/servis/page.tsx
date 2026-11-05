import type { Metadata } from "next";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormTagih, FormTerima, LangkahServis } from "@/components/app/servis";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { asalTautan } from "@/lib/mcp/http";
import { pesanStatusServis } from "@/lib/servis";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Order servis" };

type Order = { id: string; nomor: string; kode: string; pelanggan: string; pelanggan_hp: string | null; item: string; keluhan: string | null; estimasi: number | null;
  janji_selesai: string | null; status: "diterima" | "dikerjakan" | "selesai" | "diambil" | "batal"; invoice_id: string | null; invoice?: { nomor: string; kode_verifikasi: string } | null };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).servis;
  const supabase = await createClient();
  const pengelola = ["pemilik", "admin", "akuntan"].includes(sesi.peran);
  const [jalan, akhir, usaha, zona, h] = await Promise.all([
    supabase.from("service_order").select("id, nomor, kode, pelanggan, pelanggan_hp, item, keluhan, estimasi, janji_selesai, status, invoice_id")
      .in("status", ["diterima", "dikerjakan", "selesai"]).order("dibuat_at", { ascending: true }).limit(200),
    supabase.from("service_order").select("id, nomor, kode, pelanggan, pelanggan_hp, item, keluhan, estimasi, janji_selesai, status, invoice_id")
      .in("status", ["diambil", "batal"]).order("dibuat_at", { ascending: false }).limit(30),
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).single(),
    zonaUsahaIni(sesi.perusahaanId),
    headers(),
  ]);
  const asal = asalTautan(h);
  const rp = (n: number) => formatRupiah(n, { bahasa });
  const baris = (o: Order, aktif: boolean) => {
    const url = `${asal}/servis/${o.kode}`;
    const wa = o.pelanggan_hp ? `https://wa.me/${o.pelanggan_hp}?text=${encodeURIComponent(pesanStatusServis({ pelanggan: o.pelanggan, nomor: o.nomor, item: o.item,
      usaha: usaha.data?.nama ?? "", status: o.status, url }))}` : null;
    return (
      <li key={o.id} className="py-3" data-testid="order-servis" data-nomor={o.nomor} data-status={o.status}>
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span><span className="angka font-semibold">{o.nomor}</span> <span data-pengguna>{o.pelanggan}, {o.item}</span></span>
          <span className="text-tinta-2">{t.statusNama[o.status]}</span>
        </p>
        <p className="text-tinta-2">
          {o.keluhan && <span data-pengguna>{o.keluhan}. </span>}
          {o.janji_selesai && <span>{isiTeks(t.janjiTanggal, { tanggal: formatTanggalKalender(o.janji_selesai, bahasa) })}. </span>}
          {o.estimasi !== null && <span className="angka">{isiTeks(t.estimasiRp, { rp: rp(o.estimasi) })}.</span>}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a href={`/servis/${o.kode}`} className="underline underline-offset-4" data-testid="status-publik">{t.lihatStatus}</a>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-testid="kirim-wa">{t.kirimWa}</a>}
          {o.invoice && <a href={`/i/${o.invoice.kode_verifikasi}`} className="underline underline-offset-4">{isiTeks(t.lihatTagihan, { nomor: o.invoice.nomor })}</a>}
        </p>
        {aktif && <div className="mt-2"><LangkahServis id={o.id} nomor={o.nomor} status={o.status} teks={t} /></div>}
        {pengelola && !o.invoice && o.status !== "batal" && <FormTagih id={o.id} nomor={o.nomor} uraian={isiTeks(t.uraianIsi, { item: o.item }).slice(0, 120)} estimasi={o.estimasi} teks={t} />}
      </li>
    );
  };
  const daftarJalan = (jalan.data ?? []) as unknown as Order[];
  const daftarAkhir = (akhir.data ?? []) as unknown as Order[];
  const idInv = [...daftarJalan, ...daftarAkhir].map((o) => o.invoice_id).filter((x): x is string => !!x);
  const { data: inv } = idInv.length ? await supabase.from("invoice").select("id, nomor, kode_verifikasi").in("id", idInv) : { data: [] };
  for (const o of [...daftarJalan, ...daftarAkhir]) o.invoice = (inv ?? []).find((i) => i.id === o.invoice_id) ?? null;

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/servis" judul={t.judul} ket={t.ket} />
      <section className="mt-8" aria-labelledby="terima"><h2 id="terima" className="text-lg font-semibold">{t.terimaJudul}</h2>
        <FormTerima kunci={randomUUID()} hariIni={hariIni(new Date(), zona)} teks={t} /></section>
      <section className="mt-8" aria-labelledby="jalan"><h2 id="jalan" className="text-lg font-semibold">{t.daftarJudul}</h2>
        {daftarJalan.length === 0 ? <p data-langkah='#terima' className="mt-2 text-sm text-tinta-2">{t.kosong}</p>
          : <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">{daftarJalan.map((o) => baris(o, true))}</ul>}</section>
      {daftarAkhir.length > 0 && (
        <section className="mt-8" aria-labelledby="akhir"><h2 id="akhir" className="text-lg font-semibold">{t.riwayatJudul}</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">{daftarAkhir.map((o) => baris(o, false))}</ul></section>
      )}
    </div>
  );
}

export default function HalamanServis() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
