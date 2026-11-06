"use client";

import { useState } from "react";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import { totalBaris, type BarisInvoice } from "@/lib/invoice/tagihan";

// L-07: pembuat invoice tanpa akun (setara invoice generator Jurnal). Total memakai totalBaris yang sama dengan invoice
// aplikasi. Semua di peramban: tidak ada yang dikirim; Cetak memakai dialog cetak peramban (bisa disimpan PDF).
const isian = "mt-1 h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const angka = (s: string) => Math.max(0, Math.round(Number(s.replace(/\D/g, "")) || 0));
export const CSS_CETAK = "@media print { body * { visibility: hidden !important; } #lembar-cetak, #lembar-cetak * { visibility: visible !important; } #lembar-cetak { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 24px; background: #fff; color: #000; } }";

type Baris = { uraian: string; jumlah: string; harga: string };

export function PembuatInvoice({ hariIni }: { hariIni: string }) {
  const [usaha, setUsaha] = useState("Warung Sari Rasa");
  const [kontak, setKontak] = useState("Jl. Contoh No. 1, 0812-0000-0000");
  const [pelanggan, setPelanggan] = useState("");
  const [nomor, setNomor] = useState("INV/001");
  const [tanggal, setTanggal] = useState(hariIni);
  const [tempo, setTempo] = useState("");
  const [bayar, setBayar] = useState("Transfer ke rekening atas nama usaha, atau QRIS.");
  const [baris, setBaris] = useState<Baris[]>([{ uraian: "Nasi kotak", jumlah: "20", harga: "25000" }]);
  const data: BarisInvoice[] = baris.map((b) => ({ uraian: b.uraian, jumlah: Number(b.jumlah.replace(",", ".")) || 0, harga: angka(b.harga) }));
  const total = totalBaris(data);
  const ubah = (i: number, k: keyof Baris, v: string) => setBaris(baris.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  return (
    <div className="grid gap-8 lg:grid-cols-2" data-testid="pembuat-invoice">
      <style>{CSS_CETAK}</style>
      <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Isian invoice">
        <label className="text-sm font-semibold">Nama usaha<input value={usaha} onChange={(e) => setUsaha(e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">Alamat dan kontak<input value={kontak} onChange={(e) => setKontak(e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">Ditagihkan kepada<input value={pelanggan} onChange={(e) => setPelanggan(e.target.value)} placeholder="Nama pelanggan" className={isian} /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm font-semibold">Nomor<input value={nomor} onChange={(e) => setNomor(e.target.value)} className={isian} /></label>
          <label className="text-sm font-semibold">Tanggal<input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={isian} /></label>
          <label className="text-sm font-semibold">Jatuh tempo<input type="date" value={tempo} onChange={(e) => setTempo(e.target.value)} className={isian} /></label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">Barang atau jasa</legend>
          {baris.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto] items-end gap-2" data-testid="baris-invoice">
              <label className="text-xs">Uraian<input value={b.uraian} onChange={(e) => ubah(i, "uraian", e.target.value)} className={isian} /></label>
              <label className="text-xs">Jumlah<input inputMode="decimal" value={b.jumlah} onChange={(e) => ubah(i, "jumlah", e.target.value)} className={`${isian} tabular-nums`} /></label>
              <label className="text-xs">Harga<input inputMode="numeric" value={b.harga} onChange={(e) => ubah(i, "harga", e.target.value)} className={`${isian} tabular-nums`} /></label>
              <button type="button" onClick={() => setBaris(baris.filter((_, j) => j !== i))} disabled={baris.length === 1} className="h-11 px-2 text-sm underline underline-offset-4 disabled:opacity-40" aria-label={`Hapus baris ${i + 1}`}>Hapus</button>
            </div>
          ))}
          <button type="button" onClick={() => setBaris([...baris, { uraian: "", jumlah: "1", harga: "" }])} className="justify-self-start text-sm font-semibold underline underline-offset-4">Tambah baris</button>
        </fieldset>
        <label className="text-sm font-semibold">Cara bayar<input value={bayar} onChange={(e) => setBayar(e.target.value)} className={isian} /></label>
        <button type="button" onClick={() => window.print()} className="mt-2 h-12 justify-self-start rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">Cetak atau simpan PDF</button>
      </form>
      <article id="lembar-cetak" className="rounded-[var(--radius-kartu)] border border-garis bg-kertas p-6" aria-label="Pratinjau invoice">
        <header className="flex flex-wrap justify-between gap-4">
          <div><p className="text-xl font-bold">{usaha || "Nama usaha"}</p><p className="text-sm">{kontak}</p></div>
          <div className="text-right"><p className="text-lg font-bold">INVOICE</p><p className="font-mono text-sm">{nomor}</p></div>
        </header>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-tinta-2">Ditagihkan kepada</dt><dd className="font-semibold">{pelanggan || "-"}</dd></div>
          <div className="text-right"><dt className="text-tinta-2">Tanggal</dt><dd>{tanggal ? formatTanggalKalender(tanggal) : "-"}{tempo ? `, jatuh tempo ${formatTanggalKalender(tempo)}` : ""}</dd></div>
        </dl>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-garis text-left"><th className="py-1">Uraian</th><th className="py-1 text-right">Jumlah</th><th className="py-1 text-right">Harga</th><th className="py-1 text-right">Subtotal</th></tr></thead>
          <tbody>{data.map((b, i) => <tr key={i} className="border-b border-garis"><td className="py-1">{b.uraian || "-"}</td><td className="py-1 text-right tabular-nums">{b.jumlah}</td><td className="py-1 text-right tabular-nums">{formatRupiah(b.harga)}</td><td className="py-1 text-right tabular-nums">{formatRupiah(Math.round(b.jumlah * b.harga))}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3} className="py-2 text-right font-semibold">Total</td><td className="py-2 text-right font-bold tabular-nums" data-testid="total-invoice">{formatRupiah(total)}</td></tr></tfoot>
        </table>
        <p className="mt-4 text-sm"><span className="font-semibold">Cara bayar:</span> {bayar}</p>
        <p className="mt-6 text-xs text-tinta-2">Dibuat dengan alat gratis Nadi. Di Nadi, invoice bernomor otomatis, punya tautan untuk pelanggan, QRIS, dan pengingat.</p>
      </article>
    </div>
  );
}
