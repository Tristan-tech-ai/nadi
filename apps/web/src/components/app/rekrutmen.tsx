"use client";

import { useActionState, useId } from "react";
import { batalWawancara, jadwalkanWawancara, simpanRencana, simpanRincianLowongan, type HasilRekrut } from "@/app/app/rekrutmen/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { buatIcs } from "@/lib/rekrut/ics";
import { JENIS_KERJA, SATUAN_GAJI } from "@/lib/rekrut/job-posting";

type Teks = Kamus["rekrutmen"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilRekrut }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

function Kolom({ label, children, id }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormWawancara({ pelamar, zona, kunci, teks: t }: { pelamar: { id: string; label: string }[]; zona: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilRekrut, FormData>(jadwalkanWawancara, null);
  const id = { p: useId(), w: useId(), d: useId(), l: useId(), c: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.wwJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.pelamar} id={id.p}><select id={id.p} name="lamaran" required className={isian} defaultValue="">
        <option value="">{t.pilihPelamar}</option>{pelamar.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.label}</option>)}</select></Kolom>
      <Kolom label={isiTeks(t.waktu, { zona })} id={id.w}><input id={id.w} name="waktu" type="datetime-local" required className={isian} /></Kolom>
      <Kolom label={t.durasi} id={id.d}><select id={id.d} name="durasi" className={isian} defaultValue="30">
        {[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{isiTeks(t.menit, { n })}</option>)}</select></Kolom>
      <Kolom label={t.lokasi} id={id.l}><input id={id.l} name="lokasi" required maxLength={200} placeholder={t.lokasiContoh} className={isian} /></Kolom>
      <div className="sm:col-span-2"><Kolom label={t.catatan} id={id.c}><input id={id.c} name="catatan" maxLength={500} className={isian} /></Kolom></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" disabled={sibuk}>{t.jadwalkan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

/** Unduh .ics (dibuat di peramban) dan tombol batal untuk satu jadwal. */
export function AksiWawancara({ w, teks: t }: { w: { id: string; mulai: string; selesai: string; urutan: number; judul: string; lokasi: string; catatan: string | null }; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilRekrut, FormData>(batalWawancara, null);
  const unduh = () => {
    const url = URL.createObjectURL(new Blob([buatIcs({ uid: `${w.id}@nadi`, mulai: new Date(w.mulai), selesai: new Date(w.selesai), urutan: w.urutan, judul: w.judul, lokasi: w.lokasi,
      keterangan: w.catatan })], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "wawancara.ics" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-3" aria-label={w.judul}>
      <input type="hidden" name="id" value={w.id} />
      <button type="button" onClick={unduh} className="underline underline-offset-4">{t.unduhIcs}</button>
      <Tombol type="submit" ragam="teks" disabled={sibuk}>{t.batal}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormRencana({ topi, tahun, teks: t }: { topi: { id: string; nama: string }[]; tahun: number; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilRekrut, FormData>(simpanRencana, null);
  const id = { t: useId(), n: useId(), a: useId() };
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label={isiTeks(t.mpJudul, { tahun })}>
      <input type="hidden" name="tahun" value={tahun} />
      <Kolom label={t.topi} id={id.t}><select id={id.t} name="topi" required className={isian} defaultValue=""><option value="">{t.pilihTopi}</option>
        {topi.map((x) => <option key={x.id} value={x.id} data-pengguna>{x.nama}</option>)}</select></Kolom>
      <Kolom label={t.target} id={id.n}><input id={id.n} name="target" required inputMode="numeric" className={`${isian} angka w-24`} /></Kolom>
      <Kolom label={t.anggaran} id={id.a}><input id={id.a} name="anggaran" inputMode="numeric" className={`${isian} angka w-40`} /></Kolom>
      <Tombol type="submit" disabled={sibuk}>{t.simpanRencana}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

type Rincian = { id: string; judul: string; city: string | null; region: string | null; employment_type: string; salary_min: number | null; salary_max: number | null;
  salary_unit: string; valid_through: string | null; indexable: boolean };

export function FormRincian({ l, teks: t }: { l: Rincian; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilRekrut, FormData>(simpanRincianLowongan, null);
  const id = { k: useId(), w: useId(), j: useId(), a: useId(), b: useId(), s: useId(), v: useId() };
  return (
    <form action={aksi} className="grid gap-3 text-sm sm:grid-cols-4" aria-label={l.judul}>
      <input type="hidden" name="lowongan" value={l.id} />
      <Kolom label={t.kota} id={id.k}><input id={id.k} name="kota" defaultValue={l.city ?? ""} maxLength={80} className={isian} /></Kolom>
      <Kolom label={t.wilayah} id={id.w}><input id={id.w} name="wilayah" defaultValue={l.region ?? ""} maxLength={80} className={isian} /></Kolom>
      <Kolom label={t.jenis} id={id.j}><select id={id.j} name="jenis" defaultValue={l.employment_type} className={isian}>
        {JENIS_KERJA.map((j) => <option key={j} value={j}>{t.jenisNama[j]}</option>)}</select></Kolom>
      <Kolom label={t.berlaku} id={id.v}><input id={id.v} name="berlaku_sampai" type="date" defaultValue={l.valid_through ?? ""} className={isian} /></Kolom>
      <Kolom label={t.gajiMin} id={id.a}><input id={id.a} name="gaji_min" inputMode="numeric" defaultValue={l.salary_min ?? ""} className={`${isian} angka`} /></Kolom>
      <Kolom label={t.gajiMax} id={id.b}><input id={id.b} name="gaji_max" inputMode="numeric" defaultValue={l.salary_max ?? ""} className={`${isian} angka`} /></Kolom>
      <Kolom label={t.satuan} id={id.s}><select id={id.s} name="gaji_satuan" defaultValue={l.salary_unit} className={isian}>
        {SATUAN_GAJI.map((j) => <option key={j} value={j}>{t.satuanNama[j]}</option>)}</select></Kolom>
      <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" name="terindeks" value="ya" defaultChecked={l.indexable} className="h-5 w-5" />{t.tampil}</label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanRincian}</Tombol><Hasil h={h} /></div>
    </form>
  );
}
