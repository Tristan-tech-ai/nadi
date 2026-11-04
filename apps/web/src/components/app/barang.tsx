"use client";

import { useActionState } from "react";
import { opnameStok, pindahStok, simpanGudang, simpanProduk, stokMasuk, type HasilBarang } from "@/app/app/barang/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["barang"];
type Pilihan = { id: string; nama: string };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const kotak = "mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2";

function Hasil({ h }: { h: HasilBarang }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-cap sm:col-span-2">{h.galat}</p> : <p role="status" className="text-daun sm:col-span-2">{h.pesan}</p>;
}
function Teks({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="text-tinta-2">{label}</span>{children}</label>;
}
function PilihProduk({ produk, t }: { produk: Pilihan[]; t: Teks }) {
  return (
    <Teks label={t.produk}>
      <select name="produk" required className={isian} defaultValue="">
        <option value="" disabled>{t.pilihProduk}</option>
        {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}
      </select>
    </Teks>
  );
}
function PilihGudang({ nama, label, gudang }: { nama: string; label: string; gudang: Pilihan[] }) {
  return (
    <Teks label={label}>
      <select name={nama} className={isian} defaultValue={gudang[0]?.id ?? ""}>
        {gudang.map((g) => <option key={g.id} value={g.id} data-pengguna>{g.nama}</option>)}
      </select>
    </Teks>
  );
}

export function FormProduk({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBarang, FormData>(simpanProduk, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.tambahProduk} key={h && "pesan" in h ? h.pesan : "f"}>
      <Teks label={t.nama}><input name="nama" required maxLength={120} placeholder={t.namaContoh} className={isian} /></Teks>
      <Teks label={t.kode}><input name="kode" required maxLength={40} pattern="[0-9A-Za-z._\-]+" placeholder="GULA-1" className={`${isian} font-mono`} /></Teks>
      <Teks label={t.jenis}>
        <select name="jenis" className={isian} defaultValue="barang"><option value="barang">{t.jenisBarang}</option><option value="jasa">{t.jenisJasa}</option></select>
      </Teks>
      <Teks label={t.hargaJual}><input name="harga" inputMode="numeric" required placeholder="15.000" className={`${isian} angka text-right`} /></Teks>
      <Teks label={t.satuan}><input name="satuan" maxLength={20} placeholder="pcs" className={isian} /></Teks>
      <Teks label={t.barcode}><input name="barcode" maxLength={64} inputMode="numeric" className={`${isian} font-mono`} /></Teks>
      <Teks label={t.satuanBesar}><input name="satuan_besar" maxLength={20} placeholder="dus" className={isian} /></Teks>
      <Teks label={t.faktor}><input name="faktor" inputMode="decimal" placeholder="24" className={`${isian} angka text-right`} /></Teks>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="boleh_minus" className="h-5 w-5" /><span>{t.bolehMinus}</span></label>
      <div className="sm:col-span-2"><Tombol type="submit" ragam="utama" disabled={sibuk}>{t.simpanProduk}</Tombol></div>
      <Hasil h={h} />
    </form>
  );
}

export function FormGudang({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBarang, FormData>(simpanGudang, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.tambahGudang}>
      <Teks label={t.namaGudang}><input name="nama" required maxLength={60} placeholder={t.gudangContoh} className={isian} /></Teks>
      <Teks label={t.kodeGudang}><input name="kode" required maxLength={12} pattern="[A-Za-z0-9\-]+" placeholder="GDG" className={`${isian} font-mono uppercase`} /></Teks>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="utama" className="h-5 w-5" /><span>{t.jadikanUtama}</span></label>
      <div className="sm:col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanGudang}</Tombol></div>
      <Hasil h={h} />
    </form>
  );
}

export function FormMasuk({ produk, gudang, kunci, hariIni, teks: t }: { produk: Pilihan[]; gudang: Pilihan[]; kunci: string; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBarang, FormData>(stokMasuk, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.stokMasuk}>
      <input type="hidden" name="kunci" value={kunci} />
      <PilihProduk produk={produk} t={t} />
      <PilihGudang nama="gudang" label={t.gudang} gudang={gudang} />
      <Teks label={t.jumlah}><input name="jumlah" required inputMode="decimal" className={`${isian} angka text-right`} /></Teks>
      <Teks label={t.biayaTotal}><input name="nilai" required inputMode="numeric" placeholder="250.000" className={`${isian} angka text-right`} /></Teks>
      <Teks label={t.dibayar}>
        <select name="akun" className={isian} defaultValue="2-100">
          <option value="2-100">{t.akunUtang}</option><option value="1-100">{t.akunKas}</option><option value="1-110">{t.akunBank}</option><option value="3-900">{t.akunAwal}</option>
        </select>
      </Teks>
      <Teks label={t.tanggal}><input type="date" name="tanggal" defaultValue={hariIni} max={hariIni} className={isian} /></Teks>
      <Teks label={t.batch}><input name="batch" maxLength={60} className={isian} /></Teks>
      <Teks label={t.keterangan}><input name="keterangan" maxLength={200} placeholder={t.keteranganContoh} className={isian} /></Teks>
      <div className="sm:col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatMasuk}</Tombol></div>
      <Hasil h={h} />
    </form>
  );
}

export function FormPindah({ produk, gudang, kunci, teks: t }: { produk: Pilihan[]; gudang: Pilihan[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBarang, FormData>(pindahStok, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.pindah}>
      <input type="hidden" name="kunci" value={kunci} />
      <PilihProduk produk={produk} t={t} />
      <Teks label={t.jumlah}><input name="jumlah" required inputMode="decimal" className={`${isian} angka text-right`} /></Teks>
      <PilihGudang nama="dari" label={t.dari} gudang={gudang} />
      <PilihGudang nama="ke" label={t.ke} gudang={[...gudang].reverse()} />
      <div className="sm:col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatPindah}</Tombol></div>
      <Hasil h={h} />
    </form>
  );
}

export function FormOpname({ produk, gudang, kunci, teks: t }: { produk: Pilihan[]; gudang: Pilihan[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBarang, FormData>(opnameStok, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.opname}>
      <input type="hidden" name="kunci" value={kunci} />
      <PilihProduk produk={produk} t={t} />
      <PilihGudang nama="gudang" label={t.gudang} gudang={gudang} />
      <Teks label={t.fisik}><input name="fisik" required inputMode="decimal" className={`${isian} angka text-right`} /></Teks>
      <div className="flex items-end"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatOpname}</Tombol></div>
      <Hasil h={h} />
    </form>
  );
}
