"use client";

import { useActionState, useState } from "react";
import { buatDokumen, lanjutkan, retur, tagihkan, uangMuka, type HasilJual } from "@/app/app/jual/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["jual"];
type Produk = { id: string; nama: string; harga_jual: number };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilJual }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

type Baris = { uraian: string; jumlah: string; harga: string; produk: string };
const kosong = (): Baris => ({ uraian: "", jumlah: "1", harga: "", produk: "" });

/** Penawaran atau pesanan baru. Memilih produk mengisi uraian dan harga. */
export function FormDokumen({ kunci, produk, teks: t }: { kunci: string; produk: Produk[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilJual, FormData>(buatDokumen, null);
  const [baris, setBaris] = useState<Baris[]>([kosong()]);
  const ubah = (i: number, b: Partial<Baris>) => setBaris((s) => s.map((x, j) => (j === i ? { ...x, ...b } : x)));
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.baruAria} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jenis}</span>
          <select name="jenis" className={isian} defaultValue="penawaran"><option value="penawaran">{t.jenisNama.penawaran}</option><option value="pesanan">{t.jenisNama.pesanan}</option></select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.pelanggan}</span><input name="pelanggan" required maxLength={100} className={isian} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.hp}</span><input name="hp" type="tel" maxLength={20} className={isian} /></label>
      </div>
      <fieldset>
        <legend className="text-tinta-2">{t.barang}</legend>
        <ul className="mt-1 grid gap-2">
          {baris.map((b, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 border-b border-garis pb-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5rem_8rem]" data-testid="baris-dokumen">
              <select name="produk" value={b.produk} aria-label={isiTeks(t.produkAria, { n: i + 1 })} className={`${isian} col-span-2 sm:col-span-1`}
                onChange={(e) => { const p = produk.find((x) => x.id === e.target.value); ubah(i, { produk: e.target.value, ...(p ? { uraian: p.nama, harga: String(p.harga_jual) } : {}) }); }}>
                <option value="">{t.tanpaProduk}</option>
                {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}
              </select>
              <input name="uraian" value={b.uraian} onChange={(e) => ubah(i, { uraian: e.target.value })} maxLength={120} aria-label={isiTeks(t.uraianAria, { n: i + 1 })} className={`${isian} col-span-2 sm:col-span-1`} />
              <input name="jumlah" value={b.jumlah} onChange={(e) => ubah(i, { jumlah: e.target.value })} inputMode="decimal" aria-label={isiTeks(t.jumlahAria, { n: i + 1 })} className={`${isian} angka text-right`} />
              <input name="harga" value={b.harga} onChange={(e) => ubah(i, { harga: e.target.value })} inputMode="numeric" aria-label={isiTeks(t.hargaAria, { n: i + 1 })} className={`${isian} angka text-right`} />
            </li>
          ))}
        </ul>
        {baris.length < 30 && <button type="button" className="mt-2 text-sm underline underline-offset-4" onClick={() => setBaris((s) => [...s, kosong()])}>{t.tambahBaris}</button>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.berlaku}</span><input type="date" name="berlaku" className={isian} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.catatan}</span><input name="catatan" maxLength={300} className={isian} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{t.terbitkan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function TombolLanjut({ induk, jenis, label, kunci }: { induk: string; jenis: "pesanan" | "surat_jalan"; label: string; kunci: string }) {
  const [h, aksi, sibuk] = useActionState<HasilJual, FormData>(lanjutkan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="induk" value={induk} /><input type="hidden" name="jenis" value={jenis} /><input type="hidden" name="kunci" value={kunci} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{label}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormUangMuka({ pesanan, kunci, teks: t }: { pesanan: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilJual, FormData>(uangMuka, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={t.catatUangMuka}>
      <input type="hidden" name="pesanan" value={pesanan} /><input type="hidden" name="kunci" value={kunci} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.uangMuka}</span><input name="jumlah" required inputMode="numeric" className={`${isian} angka w-32 text-right`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.cara}</span>
        <select name="cara" className={isian} defaultValue="transfer"><option value="transfer">{t.transfer}</option><option value="qris">QRIS</option><option value="tunai">{t.tunai}</option></select></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatUangMuka}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormTagih({ dokumen, sisaPersen, jatuhTempo, kunci, teks: t }: { dokumen: string; sisaPersen: number; jatuhTempo: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilJual, FormData>(tagihkan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={t.buatInvoice}>
      <input type="hidden" name="dokumen" value={dokumen} /><input type="hidden" name="kunci" value={kunci} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.persen}</span><input name="persen" defaultValue={String(sisaPersen)} inputMode="decimal" className={`${isian} angka w-20 text-right`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jatuhTempo}</span><input type="date" name="jatuh_tempo" defaultValue={jatuhTempo} className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.buatInvoice}</Tombol><Hasil h={h} />
    </form>
  );
}

/** Retur satu baris invoice (di halaman Invoice). */
export function FormRetur({ invoice, baris, kunci, teks: t }: { invoice: string; baris: { uraian: string; jumlah: number }[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilJual, FormData>(retur, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.returJudul}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={t.returJudul}>
        <input type="hidden" name="invoice" value={invoice} /><input type="hidden" name="kunci" value={kunci} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.returBaris}</span>
          <select name="indeks" className={isian}>{baris.map((b, i) => <option key={i} value={i + 1} data-pengguna>{b.uraian}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.returJumlah}</span><input name="jumlah" required inputMode="decimal" className={`${isian} angka w-20 text-right`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span><input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatRetur}</Tombol><Hasil h={h} />
      </form>
    </details>
  );
}
