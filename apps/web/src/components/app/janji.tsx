"use client";

import { useActionState, useId, type ReactNode } from "react";
import { simpanAturJanji, simpanKatalog, simpanLayananJanji, simpanPoin, statusJanji, tukarPoin, type HasilJanji } from "@/app/app/janji-temu/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["janji"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilJanji }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}
function Kolom({ label, children, lebar }: { label: string; children: (id: string) => ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}
function Formulir({ aksi, label, tombol, children, sejajar }: { aksi: (a: HasilJanji, f: FormData) => Promise<HasilJanji>; label: string; tombol: string; children?: ReactNode; sejajar?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilJanji, FormData>(aksi, null);
  return (
    <form action={kirim} className={sejajar ? "inline-flex flex-col items-start gap-1 text-sm" : "mt-3 grid grid-cols-2 gap-3 text-sm"} aria-label={label}>
      {children}
      <div className={sejajar ? "" : "col-span-2 flex flex-col items-start gap-2"}><Tombol type="submit" ragam="kedua" disabled={sibuk}>{tombol}</Tombol>{!sejajar && <Hasil h={h} />}</div>
      {sejajar && <Hasil h={h} />}
    </form>
  );
}

export function FormAturJanji({ awal, teks: t }: { awal: { aktif: boolean; jam_mulai: string; jam_selesai: string; hari_buka: number[]; jeda_menit: number } | null; teks: T }) {
  const hari = awal?.hari_buka ?? [1, 2, 3, 4, 5, 6];
  return (
    <Formulir aksi={simpanAturJanji} label={t.aturJudul} tombol={t.simpanAtur}>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="aktif" defaultChecked={awal?.aktif ?? true} className="h-5 w-5" /><span>{t.aktif}</span></label>
      <Kolom label={t.jamBuka}>{(id) => <input id={id} type="time" name="mulai" required defaultValue={(awal?.jam_mulai ?? "09:00").slice(0, 5)} className={isian} />}</Kolom>
      <Kolom label={t.jamTutup}>{(id) => <input id={id} type="time" name="selesai" required defaultValue={(awal?.jam_selesai ?? "17:00").slice(0, 5)} className={isian} />}</Kolom>
      <Kolom label={t.jeda}>{(id) => <select id={id} name="jeda" defaultValue={String(awal?.jeda_menit ?? 30)} className={isian}>{[15, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Kolom>
      <fieldset className="col-span-2"><legend className="text-tinta-2">{t.hariBuka}</legend>
        <div className="mt-1 flex flex-wrap gap-3">{(["1", "2", "3", "4", "5", "6", "7"] as const).map((d) => (
          <label key={d} className="flex items-center gap-1"><input type="checkbox" name="hari" value={d} defaultChecked={hari.includes(Number(d))} className="h-5 w-5" /><span>{t.hari[d]}</span></label>
        ))}</div>
      </fieldset>
    </Formulir>
  );
}

export function FormLayananJanji({ teks: t }: { teks: T }) {
  return (
    <Formulir aksi={simpanLayananJanji} label={t.layananJudul} tombol={t.simpanLayanan}>
      <Kolom label={t.namaLayanan} lebar>{(id) => <input id={id} name="nama" required minLength={2} maxLength={80} placeholder={t.contohLayanan} className={isian} />}</Kolom>
      <Kolom label={t.durasi}>{(id) => <input id={id} name="durasi" inputMode="numeric" required defaultValue="60" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.harga}>{(id) => <input id={id} name="harga" inputMode="numeric" required defaultValue="0" className={`${isian} angka`} />}</Kolom>
    </Formulir>
  );
}

export function TombolStatusJanji({ id, status, label, teks }: { id: string; status: "datang" | "batal"; label: string; teks: string }) {
  return <Formulir aksi={statusJanji} label={label} tombol={teks} sejajar><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /></Formulir>;
}

export function FormKatalog({ awal, teks: t }: { awal: { aktif: boolean; wa: string } | null; teks: T }) {
  return (
    <Formulir aksi={simpanKatalog} label={t.katalogJudul} tombol={t.simpanKatalog}>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="aktif" defaultChecked={awal?.aktif ?? true} className="h-5 w-5" /><span>{t.aktif}</span></label>
      <Kolom label={t.waKatalog} lebar>{(id) => <input id={id} name="wa" inputMode="tel" required defaultValue={awal?.wa ? `0${awal.wa.slice(2)}` : ""} placeholder="0812-3456-7890" className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormPoin({ rp, teks: t }: { rp: number | null; teks: T }) {
  return (
    <Formulir aksi={simpanPoin} label={t.poinJudul} tombol={t.simpanPoin}>
      <Kolom label={t.rpPerPoin}>{(id) => <input id={id} name="rp" inputMode="numeric" required defaultValue={rp ?? 10000} className={`${isian} angka`} />}</Kolom>
    </Formulir>
  );
}

export function FormTukar({ pelanggan, teks: t }: { pelanggan: string; teks: T }) {
  return (
    <Formulir aksi={tukarPoin} label={`${t.tukar}: ${pelanggan}`} tombol={t.tukar}>
      <input type="hidden" name="pelanggan" value={pelanggan} />
      <Kolom label={t.jumlahPoin}>{(id) => <input id={id} name="poin" inputMode="numeric" required className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.untuk}>{(id) => <input id={id} name="untuk" required minLength={3} maxLength={200} placeholder={t.contohUntuk} className={isian} />}</Kolom>
    </Formulir>
  );
}
