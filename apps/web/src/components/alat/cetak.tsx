"use client";

import { useState } from "react";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import { teksAlat } from "@/lib/alat/teks";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { totalBaris, type BarisInvoice } from "@/lib/invoice/tagihan";

// L-07: pembuat invoice tanpa akun (setara invoice generator Jurnal). Total memakai totalBaris yang sama dengan invoice
// aplikasi. Semua di peramban: tidak ada yang dikirim; Cetak memakai dialog cetak peramban (bisa disimpan PDF).
const isian = "mt-1 h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const angka = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, "")) || 0));
export const CSS_CETAK = "@media print { body * { visibility: hidden !important; } #lembar-cetak, #lembar-cetak * { visibility: visible !important; } #lembar-cetak { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 24px; background: var(--kertas); color: var(--tinta); } }";

type Baris = { uraian: string; jumlah: string; harga: string };

export function PembuatInvoice({ hariIni, bahasa = "id" }: { hariIni: string; bahasa?: Bahasa }) {
  const t = teksAlat(bahasa);
  const [usaha, setUsaha] = useState("Warung Sari Rasa");
  const [kontak, setKontak] = useState("Jl. Contoh No. 1, 0812-0000-0000");
  const [pelanggan, setPelanggan] = useState("");
  const [nomor, setNomor] = useState("INV/001");
  const [tanggal, setTanggal] = useState(hariIni);
  const [tempo, setTempo] = useState("");
  const [bayar, setBayar] = useState<string>(t.caraBayarAwal);
  const [baris, setBaris] = useState<Baris[]>([{ uraian: t.uraianAwal, jumlah: "20", harga: "25000" }]);
  const data: BarisInvoice[] = baris.map((b) => ({ uraian: b.uraian, jumlah: Number(b.jumlah.replace(",", ".")) || 0, harga: angka(b.harga) }));
  const total = totalBaris(data);
  const ubah = (i: number, k: keyof Baris, v: string) => setBaris(baris.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  return (
    <div className="grid gap-8 lg:grid-cols-2" data-testid="pembuat-invoice">
      <style>{CSS_CETAK}</style>
      <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()} aria-label={t.isianInvoice}>
        <label className="text-sm font-semibold">{t.namaUsaha}<input value={usaha} onChange={(e) => setUsaha(e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">{t.alamat}<input value={kontak} onChange={(e) => setKontak(e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">{t.ditagihkan}<input value={pelanggan} onChange={(e) => setPelanggan(e.target.value)} placeholder={t.namaPelanggan} className={isian} /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm font-semibold">{t.nomor}<input value={nomor} onChange={(e) => setNomor(e.target.value)} className={isian} /></label>
          <label className="text-sm font-semibold">{t.tanggal}<input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={isian} /></label>
          <label className="text-sm font-semibold">{t.tempo}<input type="date" value={tempo} onChange={(e) => setTempo(e.target.value)} className={isian} /></label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">{t.barangJasa}</legend>
          {baris.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto] items-end gap-2" data-testid="baris-invoice">
              <label className="text-xs">{t.uraian}<input value={b.uraian} onChange={(e) => ubah(i, "uraian", e.target.value)} className={isian} /></label>
              <label className="text-xs">{t.jml}<input inputMode="decimal" value={b.jumlah} onChange={(e) => ubah(i, "jumlah", e.target.value)} className={`${isian} tabular-nums`} /></label>
              <label className="text-xs">{t.harga}<input inputMode="numeric" value={b.harga} onChange={(e) => ubah(i, "harga", e.target.value)} className={`${isian} tabular-nums`} /></label>
              <button type="button" onClick={() => setBaris(baris.filter((_, j) => j !== i))} disabled={baris.length === 1} className="h-11 px-2 text-sm underline underline-offset-4 disabled:opacity-40" aria-label={t.hapusBaris(i + 1)}>{t.hapus}</button>
            </div>
          ))}
          <button type="button" onClick={() => setBaris([...baris, { uraian: "", jumlah: "1", harga: "" }])} className="justify-self-start text-sm font-semibold underline underline-offset-4">{t.tambahBaris}</button>
        </fieldset>
        <label className="text-sm font-semibold">{t.caraBayar}<input value={bayar} onChange={(e) => setBayar(e.target.value)} className={isian} /></label>
        <button type="button" onClick={() => window.print()} className="mt-2 h-12 justify-self-start rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">{t.cetak}</button>
      </form>
      <article id="lembar-cetak" className="rounded-[var(--radius-kartu)] border border-garis bg-kertas p-6" aria-label={t.pratinjauInvoice}>
        <header className="flex flex-wrap justify-between gap-4">
          <div><p className="text-xl font-bold">{usaha || t.namaUsaha}</p><p className="text-sm">{kontak}</p></div>
          <div className="text-right"><p className="text-lg font-bold">INVOICE</p><p className="font-mono text-sm">{nomor}</p></div>
        </header>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-tinta-2">{t.ditagihkan}</dt><dd className="font-semibold">{pelanggan || "-"}</dd></div>
          <div className="text-right"><dt className="text-tinta-2">{t.tanggal}</dt><dd>{tanggal ? formatTanggalKalender(tanggal) : "-"}{tempo ? `, ${t.jatuhTempo} ${formatTanggalKalender(tempo)}` : ""}</dd></div>
        </dl>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-garis text-left"><th className="py-1">{t.uraian}</th><th className="py-1 text-right">{t.jml}</th><th className="py-1 text-right">{t.harga}</th><th className="py-1 text-right">{t.subtotal}</th></tr></thead>
          <tbody>{data.map((b, i) => <tr key={i} className="border-b border-garis"><td className="py-1">{b.uraian || "-"}</td><td className="py-1 text-right tabular-nums">{b.jumlah}</td><td className="py-1 text-right tabular-nums">{formatRupiah(b.harga)}</td><td className="py-1 text-right tabular-nums">{formatRupiah(Math.round(b.jumlah * b.harga))}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3} className="py-2 text-right font-semibold">{t.total}</td><td className="py-2 text-right font-bold tabular-nums" data-testid="total-invoice">{formatRupiah(total)}</td></tr></tfoot>
        </table>
        <p className="mt-4 text-sm"><span className="font-semibold">{t.caraBayar}:</span> {bayar}</p>
        <p className="mt-6 text-xs text-tinta-2">{t.kakiInvoice}</p>
      </article>
    </div>
  );
}
