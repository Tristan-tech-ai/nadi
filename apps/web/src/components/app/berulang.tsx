"use client";

import { useActionState, useId } from "react";
import { simpanBerulang, ubahBerulang, type HasilBerulang } from "@/app/app/invoice/berulang-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["berulang"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilBerulang }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormBerulang({ kunci, hariIni, teks: t }: { kunci: string; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBerulang, FormData>(simpanBerulang, null);
  const id = { p: useId(), hp: useId(), u: useId(), hr: useId(), ti: useId(), m: useId(), s: useId(), te: useId(), c: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-3" aria-label={t.judul} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.pelanggan} id={id.p}><input id={id.p} name="pelanggan" required maxLength={100} className={isian} /></Kolom>
      <Kolom label={t.hp} id={id.hp}><input id={id.hp} name="hp" inputMode="tel" placeholder="0812-3456-7890" className={isian} /></Kolom>
      <Kolom label={t.uraian} id={id.u}><input id={id.u} name="uraian" required maxLength={120} placeholder={t.uraianContoh} className={isian} /></Kolom>
      <Kolom label={t.harga} id={id.hr}><input id={id.hr} name="harga" required inputMode="numeric" className={`${isian} angka`} /></Kolom>
      <Kolom label={t.tiap} id={id.ti}><select id={id.ti} name="tiap" defaultValue="1" className={isian}>
        {(["1", "3", "6", "12"] as const).map((x) => <option key={x} value={x}>{t.tiapNama[x]}</option>)}</select></Kolom>
      <Kolom label={t.tempo} id={id.te}><input id={id.te} name="tempo" type="number" min={0} max={60} defaultValue={7} className={`${isian} angka`} /></Kolom>
      <Kolom label={t.mulai} id={id.m}><input id={id.m} name="mulai" type="date" required defaultValue={hariIni} className={isian} /></Kolom>
      <Kolom label={t.sampai} id={id.s}><input id={id.s} name="sampai" type="date" className={isian} /></Kolom>
      <Kolom label={t.catatan} id={id.c}><input id={id.c} name="catatan" maxLength={200} className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" disabled={sibuk}>{t.simpan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

/** Tombol jeda/lanjutkan per jadwal, atau terbitkan semua yang jatuh tempo (tanpa id). */
export function AksiBerulang({ id, status, teks: t }: { id?: string; status?: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBerulang, FormData>(ubahBerulang, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2 text-sm" aria-label={id ? `${t.judul} ${id.slice(0, 8)}` : t.terbitkan}>
      {id && <input type="hidden" name="id" value={id} />}
      {!id ? <Tombol type="submit" ragam="kedua" name="aksi" value="terbitkan" disabled={sibuk}>{t.terbitkan}</Tombol>
        : status === "aktif" ? <Tombol type="submit" ragam="teks" name="aksi" value="jeda" disabled={sibuk}>{t.jeda}</Tombol>
        : status === "jeda" ? <Tombol type="submit" ragam="teks" name="aksi" value="aktif" disabled={sibuk}>{t.lanjut}</Tombol> : null}
      <Hasil h={h} />
    </form>
  );
}
