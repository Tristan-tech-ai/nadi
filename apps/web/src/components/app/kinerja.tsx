"use client";

import { useActionState, useId } from "react";
import { aksiSiklus, bukaSiklus, kirimReview, simpanIdp, simpanTujuan, type HasilKinerja } from "@/app/app/kinerja/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["kinerja"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilKinerja }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormReview({ entry, judul, kompetensi, teks: t }: { entry: string; judul: string; kompetensi: string[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(kirimReview, null);
  const dasar = useId();
  return (
    <form action={aksi} className="grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={judul}>
      <p className="font-semibold sm:col-span-2" data-pengguna>{judul}</p>
      <input type="hidden" name="entry" value={entry} />
      {kompetensi.map((k, i) => (
        <div key={k}><input type="hidden" name="kompetensi" value={k} />
          <Kolom label={isiTeks(t.skorLabel, { kompetensi: k })} id={`${dasar}-${i}`}>
            <select id={`${dasar}-${i}`} name={`skor:${k}`} required defaultValue="" className={isian}><option value="">{t.pilihSkor}</option>
              {(["1", "2", "3", "4", "5"] as const).map((s) => <option key={s} value={s}>{t.skorNama[s]}</option>)}</select>
          </Kolom></div>
      ))}
      <div className="sm:col-span-2"><Kolom label={t.komentar} id={`${dasar}-c`}><textarea id={`${dasar}-c`} name="komentar" maxLength={1000} rows={2} className="w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" /></Kolom></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" disabled={sibuk}>{t.kirim}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormTujuan({ orang, pilihan, hariIni, teks: t }: { orang: string; pilihan?: { id: string; nama: string }[]; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(simpanTujuan, null);
  const id = { o: useId(), j: useId(), t: useId(), s: useId(), m: useId(), e: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={pilihan ? t.tujuanOrang : t.tujuanJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      {pilihan ? <Kolom label={t.orang} id={id.o}><select id={id.o} name="orang" required defaultValue="" className={isian}><option value="" />
        {pilihan.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></Kolom> : <input type="hidden" name="orang" value={orang} />}
      <Kolom label={t.judulTujuan} id={id.j}><input id={id.j} name="judul" required minLength={3} maxLength={160} placeholder={t.tujuanContoh} className={isian} /></Kolom>
      <Kolom label={t.targetLabel} id={id.t}><input id={id.t} name="target" inputMode="decimal" className={`${isian} angka`} /></Kolom>
      <Kolom label={t.satuan} id={id.s}><input id={id.s} name="satuan" maxLength={30} className={isian} /></Kolom>
      <Kolom label={t.mulai} id={id.m}><input id={id.m} name="mulai" type="date" required defaultValue={hariIni} className={isian} /></Kolom>
      <Kolom label={t.selesai} id={id.e}><input id={id.e} name="selesai" type="date" required defaultValue={hariIni} className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanTujuan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormProgres({ id: goal, judul, progres, teks: t }: { id: string; judul: string; progres: number; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(simpanTujuan, null);
  const id = useId();
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={isiTeks(t.progres, { judul })}>
      <input type="hidden" name="id" value={goal} />
      <label htmlFor={id} className="sr-only">{isiTeks(t.progres, { judul })}</label>
      <input id={id} name="progres" inputMode="decimal" defaultValue={String(progres)} className="h-10 w-24 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base angka" />
      <Tombol type="submit" ragam="teks" disabled={sibuk}>{t.perbarui}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormIdp({ orang, teks: t }: { orang: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(simpanIdp, null);
  const id = { t: useId(), l: useId(), d: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={t.idpJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="orang" value={orang} />
      <Kolom label={t.idpTujuan} id={id.t}><input id={id.t} name="tujuan" required minLength={3} maxLength={200} className={isian} /></Kolom>
      <Kolom label={t.idpLangkah} id={id.l}><input id={id.l} name="langkah" maxLength={500} className={isian} /></Kolom>
      <Kolom label={t.idpTarget} id={id.d}><input id={id.d} name="target" type="date" className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanIdp}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormSiklus({ orang, hariIni, teks: t }: { orang: { id: string; nama: string }[]; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(bukaSiklus, null);
  const id = { n: useId(), m: useId(), s: useId(), k: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-3" aria-label={t.siklusBaru} key={h && "pesan" in h ? h.pesan : "f"}>
      <Kolom label={t.namaSiklus} id={id.n}><input id={id.n} name="nama" required minLength={3} maxLength={80} placeholder={t.namaContoh} className={isian} /></Kolom>
      <Kolom label={t.mulai} id={id.m}><input id={id.m} name="mulai" type="date" required defaultValue={hariIni} className={isian} /></Kolom>
      <Kolom label={t.selesai} id={id.s}><input id={id.s} name="selesai" type="date" required defaultValue={hariIni} className={isian} /></Kolom>
      <div className="sm:col-span-3"><Kolom label={t.kompetensi} id={id.k}><input id={id.k} name="kompetensi" required defaultValue={t.kompetensiBawaan} className={isian} /></Kolom></div>
      <fieldset className="sm:col-span-3"><legend className="text-tinta-2">{t.peserta}</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">{orang.map((o) => (
          <label key={o.id} className="flex items-center gap-2"><input type="checkbox" name="peserta" value={o.id} className="h-5 w-5" /><span data-pengguna>{o.nama}</span></label>))}</div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" disabled={sibuk}>{t.buatSiklus}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormKalibrasi({ cycle, orang, nama, teks: t }: { cycle: string; orang: string; nama: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(aksiSiklus, null);
  const id = { s: useId(), p: useId() };
  const label = isiTeks(t.kalibrasi, { nama });
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={label}>
      <input type="hidden" name="cycle" value={cycle} /><input type="hidden" name="orang" value={orang} /><input type="hidden" name="aksi" value="kalibrasi" />
      <div className="flex flex-col gap-1"><label htmlFor={id.s} className="text-tinta-2">{t.skorAkhir}</label><input id={id.s} name="skor" inputMode="decimal" className="h-10 w-24 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base angka" /></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.p} className="text-tinta-2">{t.potensi}</label>
        <select id={id.p} name="potensi" defaultValue="2" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base">
          {(["1", "2", "3"] as const).map((x) => <option key={x} value={x}>{t.potensiNama[x]}</option>)}</select></div>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanKalibrasi}<span className="sr-only"> {nama}</span></Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormSiklusLain({ cycle, peserta, orang, teks: t }: { cycle: string; peserta: { id: string; nama: string }[]; orang: { id: string; nama: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKinerja, FormData>(aksiSiklus, null);
  const id = { o: useId(), r: useId() };
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-2 text-sm" aria-label={t.tambahRekan}>
      <input type="hidden" name="cycle" value={cycle} />
      <div className="flex flex-col gap-1"><label htmlFor={id.o} className="text-tinta-2">{t.dinilai}</label>
        <select id={id.o} name="orang" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base">{peserta.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.r} className="text-tinta-2">{t.rekan}</label>
        <select id={id.r} name="rekan" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base">{orang.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></div>
      <Tombol type="submit" ragam="kedua" name="aksi" value="rekan" disabled={sibuk}>{t.tambah}</Tombol>
      <Tombol type="submit" ragam="teks" name="aksi" value="tutup" disabled={sibuk}>{t.tutup}</Tombol>
      <Hasil h={h} />
    </form>
  );
}
