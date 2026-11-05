"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { balasObrolan, simpanArtikel, simpanAtur, simpanTemplat, tugaskanObrolan, tutupObrolan, type HasilLayanan } from "@/app/app/layanan/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["layanan"];
const isian = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 py-2 text-base";

function Hasil({ h }: { h: HasilLayanan }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}
function Kolom({ label, children, lebar }: { label: string; children: (id: string) => ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}
function Formulir({ aksi, label, tombol, children, ragam = "kedua", sejajar }: { aksi: (a: HasilLayanan, f: FormData) => Promise<HasilLayanan>; label: string; tombol: string; children?: ReactNode; ragam?: "utama" | "kedua"; sejajar?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilLayanan, FormData>(aksi, null);
  return (
    <form action={kirim} className={sejajar ? "flex flex-wrap items-end gap-2 text-sm" : "mt-3 grid grid-cols-2 gap-3 text-sm"} aria-label={label}>
      {children}
      <div className={sejajar ? "flex flex-col items-start gap-1" : "col-span-2 flex flex-col items-start gap-2"}><Tombol type="submit" ragam={ragam} disabled={sibuk}>{tombol}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormAtur({ awal, teks: t }: { awal: { aktif: boolean; jam_mulai: string; jam_selesai: string; sla_menit: number; pesan_sambutan: string; pesan_luar_jam: string } | null; teks: T }) {
  return (
    <Formulir aksi={simpanAtur} label={t.aturJudul} tombol={t.simpanAtur}>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="aktif" defaultChecked={awal?.aktif ?? true} className="h-5 w-5" /><span>{t.aktif}</span></label>
      <Kolom label={t.jamMulai}>{(id) => <input id={id} type="time" name="mulai" required defaultValue={(awal?.jam_mulai ?? "08:00").slice(0, 5)} className={isian} />}</Kolom>
      <Kolom label={t.jamSelesai}>{(id) => <input id={id} type="time" name="selesai" required defaultValue={(awal?.jam_selesai ?? "17:00").slice(0, 5)} className={isian} />}</Kolom>
      <Kolom label={t.sla}>{(id) => <input id={id} name="sla" inputMode="numeric" required defaultValue={awal?.sla_menit ?? 60} className={`${isian} angka`} />}</Kolom>
      <div />
      <Kolom label={t.sambutan} lebar>{(id) => <input id={id} name="sambutan" maxLength={300} defaultValue={awal?.pesan_sambutan ?? ""} className={isian} />}</Kolom>
      <Kolom label={t.luarJam} lebar>{(id) => <input id={id} name="luar_jam" maxLength={300} defaultValue={awal?.pesan_luar_jam ?? ""} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormArtikel({ teks: t }: { teks: T }) {
  return (
    <Formulir aksi={simpanArtikel} label={t.artikelJudul} tombol={t.simpanArtikel}>
      <Kolom label={t.judulArtikel} lebar>{(id) => <input id={id} name="judul" required minLength={3} maxLength={120} placeholder={t.contohJudul} className={isian} />}</Kolom>
      <Kolom label={t.isiArtikel} lebar>{(id) => <textarea id={id} name="isi" required minLength={10} maxLength={2000} rows={3} placeholder={t.contohIsi} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormBalas({ id: c, nama, templat = [], teks: t }: { id: string; nama: string; templat?: { judul: string; isi: string }[]; teks: T }) {
  const [isi, setIsi] = useState("");
  return (
    <Formulir aksi={balasObrolan} label={`${t.balas}: ${nama}`} tombol={t.kirim} ragam="utama">
      <input type="hidden" name="id" value={c} />
      {templat.length > 0 && <Kolom label={t.pakaiTemplat} lebar>{(id) => (
        <select id={id} defaultValue="" onChange={(e) => { const x = templat.find((p) => p.judul === e.target.value); if (x) setIsi(x.isi.replace("{nama}", nama)); }} className={isian}>
          <option value="">{t.pakaiTemplat}</option>{templat.map((p) => <option key={p.judul} value={p.judul} data-pengguna>{p.judul}</option>)}
        </select>)}</Kolom>}
      <Kolom label={t.tulisBalas} lebar>{(id) => <textarea id={id} name="isi" required maxLength={2000} rows={2} value={isi} onChange={(e) => setIsi(e.target.value)} className={isian} />}</Kolom>
    </Formulir>
  );
}

export function FormTemplat({ teks: t }: { teks: T }) {
  return (
    <Formulir aksi={simpanTemplat} label={t.templatJudul} tombol={t.simpanTemplat}>
      <Kolom label={t.judulTemplat} lebar>{(id) => <input id={id} name="judul" required minLength={2} maxLength={60} className={isian} />}</Kolom>
      <Kolom label={t.isiTemplat} lebar>{(id) => <textarea id={id} name="isi" required minLength={2} maxLength={2000} rows={2} placeholder="Halo {nama}, ..." className={isian} />}</Kolom>
    </Formulir>
  );
}

export function TombolTutup({ id, nama, teks: t }: { id: string; nama: string; teks: T }) {
  return <Formulir aksi={tutupObrolan} label={`${t.tutup}: ${nama}`} tombol={t.tutup} sejajar><input type="hidden" name="id" value={id} /></Formulir>;
}

export function FormTugaskan({ id: c, nama, agen, sekarang, teks: t }: { id: string; nama: string; agen: { id: string; nama: string }[]; sekarang: string | null; teks: T }) {
  const idSel = useId();
  return (
    <Formulir aksi={tugaskanObrolan} label={`${t.tugaskan}: ${nama}`} tombol={t.simpanTugas} sejajar>
      <input type="hidden" name="id" value={c} />
      <div className="flex flex-col gap-1"><label htmlFor={idSel} className="text-tinta-2">{t.tugaskan}</label>
        <select id={idSel} name="agen" defaultValue={sekarang ?? ""} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2"><option value="">{t.tanpaAgen}</option>{agen.map((a) => <option key={a.id} value={a.id} data-pengguna>{a.nama}</option>)}</select></div>
    </Formulir>
  );
}
