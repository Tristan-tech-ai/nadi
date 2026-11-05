"use client";

import { useActionState, useId, useState } from "react";
import { buatPerintahKerja, langkahPerintahKerja, rakitBongkar, simpanResep, type HasilProduksi } from "@/app/app/produksi/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["produksi"];
export type ProdukPilih = { id: string; nama: string; satuan: string };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilProduksi }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

function Pilih({ name, produk, value, onChange, label, kosong }: { name: string; produk: ProdukPilih[]; value: string; onChange: (v: string) => void; label: string; kosong: string }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${isian} min-w-0`}>
      <option value="">{kosong}</option>
      {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}
    </select>
  );
}

type BarisBahan = { produk: string; jumlah: string };
type BarisLain = BarisBahan & { jenis: "bersama" | "sampingan" };

/** Resep (BoM): barang jadi, jumlah hasil per resep, biaya tenaga dan overhead, bahan, hasil lain. */
export function FormResep({ produk, teks: t }: { produk: ProdukPilih[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProduksi, FormData>(simpanResep, null);
  const [hasil, setHasil] = useState("");
  const [bahan, setBahan] = useState<BarisBahan[]>([{ produk: "", jumlah: "" }]);
  const [lain, setLain] = useState<BarisLain[]>([]);
  const id = { hasil: useId(), jumlah: useId(), konv: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.bomJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1"><label htmlFor={id.hasil} className="text-tinta-2">{t.hasil}</label>
          <select id={id.hasil} name="produk" required value={hasil} onChange={(e) => setHasil(e.target.value)} className={isian}>
            <option value="">{t.pilih}</option>
            {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}
          </select></div>
        <div className="flex flex-col gap-1"><label htmlFor={id.jumlah} className="text-tinta-2">{t.jumlahHasil}</label>
          <input id={id.jumlah} name="jumlah_hasil" required inputMode="decimal" defaultValue="1" className={`${isian} angka`} /></div>
        <div className="flex flex-col gap-1"><label htmlFor={id.konv} className="text-tinta-2">{t.konversi}</label>
          <input id={id.konv} name="biaya_konversi" inputMode="numeric" defaultValue="0" className={`${isian} angka`} /></div>
      </div>
      <fieldset><legend className="text-tinta-2">{t.bahan}</legend>
        <ul className="mt-1 grid gap-2">{bahan.map((b, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <Pilih name="bahan" produk={produk.filter((p) => p.id !== hasil)} value={b.produk} kosong={t.pilih} label={isiTeks(t.bahanAria, { n: i + 1 })}
              onChange={(v) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, produk: v } : x)))} />
            <input name="bahan_jumlah" value={b.jumlah} inputMode="decimal" aria-label={isiTeks(t.jumlahAria, { n: i + 1 })} className={`${isian} angka text-right`}
              onChange={(e) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))} />
          </li>))}</ul>
        {bahan.length < 30 && <button type="button" className="mt-2 underline underline-offset-4" onClick={() => setBahan((s) => [...s, { produk: "", jumlah: "" }])}>{t.tambahBahan}</button>}
      </fieldset>
      <fieldset><legend className="text-tinta-2">{t.lain}</legend>
        <ul className="mt-1 grid gap-2">{lain.map((b, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_10rem]">
            <Pilih name="lain" produk={produk.filter((p) => p.id !== hasil)} value={b.produk} kosong={t.pilih} label={isiTeks(t.lainAria, { n: i + 1 })}
              onChange={(v) => setLain((s) => s.map((x, j) => (j === i ? { ...x, produk: v } : x)))} />
            <input name="lain_jumlah" value={b.jumlah} inputMode="decimal" aria-label={isiTeks(t.lainJumlahAria, { n: i + 1 })} className={`${isian} angka text-right`}
              onChange={(e) => setLain((s) => s.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))} />
            <select name="lain_jenis" value={b.jenis} aria-label={isiTeks(t.jenisAria, { n: i + 1 })} className={`${isian} col-span-2 sm:col-span-1`}
              onChange={(e) => setLain((s) => s.map((x, j) => (j === i ? { ...x, jenis: e.target.value as BarisLain["jenis"] } : x)))}>
              <option value="bersama">{t.bersama}</option><option value="sampingan">{t.sampingan}</option>
            </select>
          </li>))}</ul>
        {lain.length < 10 && <button type="button" className="mt-2 underline underline-offset-4" onClick={() => setLain((s) => [...s, { produk: "", jumlah: "", jenis: "sampingan" }])}>{t.tambahLain}</button>}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{t.simpanBom}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormPerintahKerja({ produk, kunci, teks: t }: { produk: ProdukPilih[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProduksi, FormData>(buatPerintahKerja, null);
  const id = { p: useId(), j: useId() };
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label={t.pkBaru}>
      <input type="hidden" name="kunci" value={kunci} />
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id.p} className="text-tinta-2">{t.hasil}</label>
        <select id={id.p} name="produk" required className={isian} defaultValue=""><option value="">{t.pilih}</option>
          {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.j} className="text-tinta-2">{t.jumlahPk}</label>
        <input id={id.j} name="jumlah" required inputMode="decimal" className={`${isian} angka w-28`} /></div>
      <Tombol type="submit" disabled={sibuk}>{t.buatPk}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function LangkahPK({ wo, status, rencana, nomor, teks: t }: { wo: string; status: string; rencana: number; nomor: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProduksi, FormData>(langkahPerintahKerja, null);
  const idHasil = useId();
  return (
    <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2 text-sm" aria-label={nomor}>
      <input type="hidden" name="wo" value={wo} />
      {status === "planned" && <Tombol type="submit" name="langkah" value="ambil" disabled={sibuk}>{t.ambil}</Tombol>}
      {status === "running" && (<>
        <div className="flex flex-col gap-1"><label htmlFor={idHasil} className="text-tinta-2">{t.hasilNyata}</label>
          <input id={idHasil} name="hasil" defaultValue={String(rencana)} inputMode="decimal" className={`${isian} angka w-28`} /></div>
        <Tombol type="submit" name="langkah" value="selesai" disabled={sibuk}>{t.selesai}</Tombol>
      </>)}
      {(status === "planned" || status === "running") && <Tombol type="submit" ragam="teks" name="langkah" value="batal" disabled={sibuk}>{t.batal}</Tombol>}
      <Hasil h={h} />
    </form>
  );
}

export function FormRakit({ produk, kunci, teks: t }: { produk: ProdukPilih[]; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProduksi, FormData>(rakitBongkar, null);
  const id = { p: useId(), j: useId() };
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label={t.rakitJudul}>
      <input type="hidden" name="kunci" value={kunci} />
      <fieldset className="flex items-center gap-3"><legend className="sr-only">{t.aksi}</legend>
        <label className="flex items-center gap-1"><input type="radio" name="aksi" value="rakit" defaultChecked className="h-5 w-5" />{t.rakit}</label>
        <label className="flex items-center gap-1"><input type="radio" name="aksi" value="bongkar" className="h-5 w-5" />{t.bongkar}</label>
      </fieldset>
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id.p} className="text-tinta-2">{t.hasil}</label>
        <select id={id.p} name="produk" required className={isian} defaultValue=""><option value="">{t.pilih}</option>
          {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.j} className="text-tinta-2">{t.jumlahPk}</label>
        <input id={id.j} name="jumlah" required inputMode="decimal" className={`${isian} angka w-28`} /></div>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.jalankan}</Tombol>
      <Hasil h={h} />
    </form>
  );
}
