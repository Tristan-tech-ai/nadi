"use client";

import { useActionState, useId, useState } from "react";
import { catatAset, jalankanPenyusutan, lepasAset, pinjamkanAset, type HasilAset } from "@/app/app/aset/actions";
import { Tombol } from "@/components/ui/tombol";
import { jadwalSusut, type Kelompok, type Metode } from "@/lib/aset/susut";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["aset"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
function Hasil({ h }: { h: HasilAset }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>;
}
function Kolom({ label, children, lebar = false }: { label: string; children: (id: string) => React.ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}

/** Catat aset; pratinjau penyusutan bulan pertama dihitung di peramban dengan rumus yang sama dengan database. */
export function FormAset({ hari, teks: t }: { hari: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilAset, FormData>(catatAset, null);
  const [kelompok, setKelompok] = useState<Kelompok>("k1");
  const [metode, setMetode] = useState<Metode>("garis_lurus");
  const [harga, setHarga] = useState("");
  const [tanggal, setTanggal] = useState(hari);
  const bangunan = kelompok.startsWith("bangunan") || kelompok === "tanah";
  const n = Number(harga.replace(/[^\d]/g, "") || 0);
  const pratinjau = n > 0 && tanggal ? jadwalSusut(n, kelompok, bangunan ? "garis_lurus" : metode, tanggal.slice(0, 7))[0]?.nilai : undefined;
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.catatAria}>
      <Kolom label={t.nama} lebar>{(id) => <input id={id} name="nama" required minLength={2} maxLength={120} placeholder={t.namaContoh} className={isian} />}</Kolom>
      <Kolom label={t.kelompok}>{(id) => (
        <select id={id} name="kelompok" value={kelompok} onChange={(e) => setKelompok(e.target.value as Kelompok)} className={isian}>
          {(Object.keys(t.kelompokNama) as Kelompok[]).map((k) => <option key={k} value={k}>{t.kelompokNama[k]}</option>)}
        </select>)}</Kolom>
      <Kolom label={t.metode}>{(id) => (
        <select id={id} name="metode" value={bangunan ? "garis_lurus" : metode} disabled={bangunan} onChange={(e) => setMetode(e.target.value as Metode)} className={isian}>
          <option value="garis_lurus">{t.garisLurus}</option><option value="saldo_menurun">{t.saldoMenurun}</option>
        </select>)}</Kolom>
      {bangunan && <input type="hidden" name="metode" value="garis_lurus" />}
      <Kolom label={t.tanggal}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={isian} />}</Kolom>
      <Kolom label={t.harga}>{(id) => <input id={id} name="harga" inputMode="numeric" required value={harga} onChange={(e) => setHarga(e.target.value)} className={isian} />}</Kolom>
      <Kolom label={t.cara} lebar>{(id) => (
        <select id={id} name="cara" defaultValue="bank" className={isian}><option value="bank">{t.caraBank}</option><option value="kas">{t.caraKas}</option><option value="tanpa_jurnal">{t.caraTanpa}</option></select>)}</Kolom>
      {pratinjau !== undefined && <p className="col-span-2 text-xs text-tinta-2" data-testid="pratinjau-susut">{t.pratinjau.replace("{n}", pratinjau.toLocaleString("id-ID"))}</p>}
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk}>{t.catat}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormPenyusutan({ sampai, teks: t }: { sampai: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilAset, FormData>(jalankanPenyusutan, null);
  return (
    <form action={aksi} className="mt-3 flex flex-col items-start gap-2 text-sm">
      <input type="hidden" name="sampai" value={sampai} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.jalankan}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormLepas({ aset, nama, hari, teks: t }: { aset: string; nama: string; hari: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilAset, FormData>(lepasAset, null);
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-tinta-2">{t.jualLepas}</summary>
      <form action={aksi} className="mt-2 grid grid-cols-2 gap-3" aria-label={`${t.jualLepas}: ${nama}`}>
        <input type="hidden" name="aset" value={aset} />
        <Kolom label={t.tanggalLepas}>{(id) => <input id={id} type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} />}</Kolom>
        <Kolom label={t.hargaJual}>{(id) => <input id={id} name="harga_jual" inputMode="numeric" defaultValue="0" className={isian} />}</Kolom>
        <Kolom label={t.diterima}>{(id) => <select id={id} name="cara" defaultValue="kas" className={isian}><option value="kas">{t.caraKas}</option><option value="bank">{t.caraBank}</option></select>}</Kolom>
        <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanLepas}</Tombol><Hasil h={h} /></div>
      </form>
    </details>
  );
}

export function FormPinjam({ aset, nama, orang, dipinjam, teks: t }: { aset: string; nama: string; orang: { id: string; nama: string }[]; dipinjam: boolean; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilAset, FormData>(pinjamkanAset, null);
  if (dipinjam) {
    return (
      <form action={aksi} className="mt-2"><input type="hidden" name="aset" value={aset} /><input type="hidden" name="orang" value="" />
        <Tombol type="submit" ragam="teks" disabled={sibuk} aria-label={`${t.kembalikan}: ${nama}`}>{t.kembalikan}</Tombol><Hasil h={h} /></form>
    );
  }
  return (
    <form action={aksi} className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2 text-sm" aria-label={`${t.pinjamkan}: ${nama}`}>
      <input type="hidden" name="aset" value={aset} />
      <Kolom label={t.pinjamKe}>{(id) => <select id={id} name="orang" required defaultValue="" className={isian}><option value="" disabled>{t.pilihOrang}</option>{orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select>}</Kolom>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.pinjamkan}</Tombol>
      <div className="col-span-2"><Hasil h={h} /></div>
    </form>
  );
}
