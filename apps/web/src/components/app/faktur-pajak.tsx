"use client";

import { useActionState } from "react";
import { simpanIdentitas, simpanPembeli, type HasilFaktur } from "@/app/app/pajak/faktur/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["faktur"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const kotak = "mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm";
const Label = ({ teks, children }: { teks: string; children: React.ReactNode }) => <label className="flex min-w-0 max-w-full flex-col gap-1"><span className="text-tinta-2">{teks}</span>{children}</label>;

function Hasil({ h }: { h: HasilFaktur }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

export function FormIdentitas({ awal, teks: t }: { awal: { npwp: string; nitku: string; termasuk: boolean; kode: string } | null; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilFaktur, FormData>(simpanIdentitas, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.identitasAria}>
      <Label teks={t.npwp}><input name="npwp" required inputMode="numeric" defaultValue={awal?.npwp ?? ""} placeholder="1091031210912281" className={`${isian} angka w-56 max-w-full`} /></Label>
      <Label teks={t.nitku}><input name="nitku" inputMode="numeric" defaultValue={awal?.nitku ?? ""} placeholder={t.nitkuContoh} className={`${isian} angka w-64 max-w-full`} /></Label>
      <Label teks={t.harga}><select name="termasuk" defaultValue={awal && !awal.termasuk ? "tidak" : "ya"} className={isian}><option value="ya">{t.termasuk}</option><option value="tidak">{t.belumTermasuk}</option></select></Label>
      <Label teks={t.kode}><select name="kode" defaultValue={awal?.kode ?? "04"} className={isian}><option value="04">{t.kode04}</option><option value="01">{t.kode01}</option></select></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpan}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormPembeli({ nama, awal, teks: t }: { nama: string; awal: { jenis: string; nomor: string; alamat: string; email: string } | null; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilFaktur, FormData>(simpanPembeli, null);
  return (
    <form action={aksi} className={kotak} aria-label={`${t.pembeliAria} ${nama}`}>
      <input type="hidden" name="nama" value={nama} />
      <Label teks={t.jenisId}><select name="jenis" defaultValue={awal?.jenis ?? "TIN"} className={isian}>
        {Object.entries(t.jenisNama).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Label>
      <Label teks={t.nomorId}><input name="nomor" required defaultValue={awal?.nomor ?? ""} className={`${isian} angka w-52 max-w-full`} /></Label>
      <Label teks={t.alamat}><input name="alamat" required maxLength={300} defaultValue={awal?.alamat ?? ""} className={`${isian} w-72 max-w-full`} /></Label>
      <Label teks={t.email}><input name="email" type="email" defaultValue={awal?.email ?? ""} className={`${isian} w-56 max-w-full`} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanPembeli}</Tombol><Hasil h={h} />
    </form>
  );
}
