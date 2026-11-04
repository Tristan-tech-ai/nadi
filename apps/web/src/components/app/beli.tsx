"use client";

import { useActionState, useState } from "react";
import { bayarTagihan, buatDokumenBeli, catatTagihan, lanjutkanBeli, returBeli, type HasilBeli } from "@/app/app/beli/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["beli"];
type Produk = { id: string; nama: string };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilBeli }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

type Baris = { uraian: string; jumlah: string; harga: string; produk: string };
const kosong = (): Baris => ({ uraian: "", jumlah: "1", harga: "", produk: "" });

/** Permintaan atau pesanan pembelian baru. Memilih produk mengisi uraian; baris dengan produk masuk stok saat diterima. */
export function FormDokumenBeli({ kunci, produk, teks: t }: { kunci: string; produk: Produk[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBeli, FormData>(buatDokumenBeli, null);
  const [baris, setBaris] = useState<Baris[]>([kosong()]);
  const ubah = (i: number, b: Partial<Baris>) => setBaris((s) => s.map((x, j) => (j === i ? { ...x, ...b } : x)));
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.baruAria} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jenis}</span>
          <select name="jenis" className={isian} defaultValue="pesanan_beli"><option value="pesanan_beli">{t.jenisNama.pesanan_beli}</option><option value="permintaan">{t.jenisNama.permintaan}</option></select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.pemasok}</span><input name="pemasok" required maxLength={100} className={isian} /></label>
      </div>
      <fieldset>
        <legend className="text-tinta-2">{t.barang}</legend>
        <ul className="mt-1 grid gap-2">
          {baris.map((b, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 border-b border-garis pb-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5rem_8rem]">
              <select name="produk" value={b.produk} aria-label={isiTeks(t.produkAria, { n: i + 1 })} className={`${isian} col-span-2 sm:col-span-1`}
                onChange={(e) => { const p = produk.find((x) => x.id === e.target.value); ubah(i, { produk: e.target.value, ...(p ? { uraian: p.nama } : {}) }); }}>
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
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.catatan}</span><input name="catatan" maxLength={300} className={isian} /></label>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{t.terbitkan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function TombolLanjutBeli({ induk, jenis, label, kunci }: { induk: string; jenis: "pesanan_beli" | "penerimaan"; label: string; kunci: string }) {
  const [h, aksi, sibuk] = useActionState<HasilBeli, FormData>(lanjutkanBeli, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="induk" value={induk} /><input type="hidden" name="jenis" value={jenis} /><input type="hidden" name="kunci" value={kunci} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{label}</Tombol><Hasil h={h} />
    </form>
  );
}

/** Tagihan pemasok. Dengan dokumen (penerimaan) pemasok diambil dari sana dan selisih ke PO dihitung database. */
export function FormTagihanBeli({ dokumen, total, hari, jatuhTempo, kunci, teks: t }: { dokumen?: string; total?: number; hari: string; jatuhTempo: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBeli, FormData>(catatTagihan, null);
  return (
    <form action={aksi} className={`flex flex-wrap items-end gap-2 text-sm ${dokumen ? "" : "mt-3 rounded-[var(--radius-kartu)] border border-garis p-4"}`} aria-label={dokumen ? t.catatTagihanDari : t.tagihanManualAria}
      key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      {dokumen ? <input type="hidden" name="dokumen" value={dokumen} /> : (
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.pemasok}</span><input name="pemasok" required maxLength={100} className={isian} /></label>
      )}
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.nomorPemasok}</span><input name="nomor" maxLength={60} className={`${isian} w-36`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.totalTagihan}</span>
        <input name="total" required inputMode="numeric" defaultValue={total ? String(total) : ""} className={`${isian} angka w-32 text-right`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tanggal}</span><input type="date" name="tanggal" defaultValue={hari} max={hari} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jatuhTempo}</span><input type="date" name="jatuh_tempo" defaultValue={jatuhTempo} className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatTagihan}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormBayarBeli({ tagihan, sisa, kunci, teks: t }: { tagihan: string; sisa: number; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBeli, FormData>(bayarTagihan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={t.bayarAria}>
      <input type="hidden" name="tagihan" value={tagihan} /><input type="hidden" name="kunci" value={kunci} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jumlahBayar}</span>
        <input name="jumlah" required inputMode="numeric" defaultValue={String(sisa)} className={`${isian} angka w-32 text-right`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.cara}</span>
        <select name="cara" className={isian} defaultValue="transfer"><option value="transfer">{t.transfer}</option><option value="tunai">{t.tunai}</option></select></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.bayar}</Tombol><Hasil h={h} />
    </form>
  );
}

/** Retur ke pemasok (nota debit) untuk barang dari penerimaan yang ditagih. */
export function FormReturBeli({ tagihan, barang, kunci, teks: t }: { tagihan: string; barang: { produk: string; uraian: string; harga: number }[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBeli, FormData>(returBeli, null);
  const [pilih, setPilih] = useState(0);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.returJudul}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={t.returJudul}>
        <input type="hidden" name="tagihan" value={tagihan} /><input type="hidden" name="kunci" value={kunci} />
        <input type="hidden" name="produk" value={barang[pilih]?.produk ?? ""} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.returBarang}</span>
          <select className={isian} value={pilih} onChange={(e) => setPilih(Number(e.target.value))}>{barang.map((b, i) => <option key={b.produk} value={i} data-pengguna>{b.uraian}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.returJumlah}</span><input name="jumlah" required inputMode="decimal" className={`${isian} angka w-20 text-right`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.returHarga}</span>
          <input name="harga" required inputMode="numeric" key={pilih} defaultValue={String(barang[pilih]?.harga ?? "")} className={`${isian} angka w-28 text-right`} /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.alasanRetur}</span><input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatRetur}</Tombol><Hasil h={h} />
      </form>
    </details>
  );
}
