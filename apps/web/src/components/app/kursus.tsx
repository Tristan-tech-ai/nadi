"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { kirimKuis, simpanKursus, simpanSoal, type HasilKuis, type HasilKursus } from "@/app/app/kursus/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["kursus"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const area = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base";

function Hasil({ h }: { h: HasilKursus }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormKursus({ butir, teks: t }: { butir: { id: string; judul: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKursus, FormData>(simpanKursus, null);
  const id = { j: useId(), r: useId(), a: useId(), b: useId(), m: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.kursusBaru}>
      <Kolom label={t.judulKursus} id={id.j}><input id={id.j} name="judul" minLength={3} maxLength={120} placeholder={t.judulContoh} className={isian} /></Kolom>
      <Kolom label={t.ambang} id={id.a}><input id={id.a} name="ambang" type="number" min={50} max={100} defaultValue={70} className={`${isian} angka`} /></Kolom>
      <div className="sm:col-span-2"><Kolom label={t.ringkasan} id={id.r}><input id={id.r} name="ringkasan" maxLength={1000} className={isian} /></Kolom></div>
      {butir.length > 0 && (
        <div className="sm:col-span-2"><Kolom label={t.dariIlmu} id={id.b}>
          <select id={id.b} name="butir" defaultValue="" className={isian}><option value="">{t.tulisSendiri}</option>
            {butir.map((b) => <option key={b.id} value={b.id} data-pengguna>{b.judul}</option>)}</select></Kolom></div>
      )}
      <div className="sm:col-span-2"><Kolom label={t.materi} id={id.m}><textarea id={id.m} name="materi" rows={4} className={area} placeholder={t.materiContoh} /></Kolom>
        <p className="mt-1 text-xs text-tinta-2">{t.materiKet}</p></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" disabled={sibuk}>{t.buatKursus}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormSoal({ course, judul, teks: t }: { course: string; judul: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKursus, FormData>(simpanSoal, null);
  const id = { q: useId(), p: useId(), k: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-[2fr_2fr_1fr]" aria-label={isiTeks(t.tambahSoalUntuk, { judul })}>
      <input type="hidden" name="course" value={course} />
      <Kolom label={t.pertanyaan} id={id.q}><input id={id.q} name="pertanyaan" required minLength={3} maxLength={300} className={isian} /></Kolom>
      <Kolom label={t.pilihan} id={id.p}><textarea id={id.p} name="pilihan" required rows={3} className={area} /></Kolom>
      <Kolom label={t.kunci} id={id.k}><input id={id.k} name="kunci" type="number" min={1} max={6} required className={`${isian} angka`} /></Kolom>
      <p className="text-xs text-tinta-2 sm:col-span-3">{t.pilihanKet}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.tambahSoal}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormKuis({ course, judul, soal, teks: t }: { course: string; judul: string; soal: { id: string; pertanyaan: string; pilihan: string[] }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilKuis, FormData>(kirimKuis, null);
  return (
    <form action={aksi} className="mt-4 grid gap-4 text-sm" aria-label={isiTeks(t.kuisUntuk, { judul })}>
      <input type="hidden" name="course" value={course} />
      {soal.map((q, i) => (
        <fieldset key={q.id} className="grid gap-2">
          <legend className="font-semibold"><span className="angka">{i + 1}.</span> <span data-pengguna>{q.pertanyaan}</span></legend>
          {q.pilihan.map((p, j) => (
            <label key={j} className="flex min-h-10 items-center gap-2"><input type="radio" name={`q:${q.id}`} value={j} required className="h-5 w-5" /><span data-pengguna>{p}</span></label>
          ))}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{t.kirimJawaban}</Tombol></div>
      {h && "galat" in h && <p role="alert" className="text-cap">{h.galat}</p>}
      {h && !("galat" in h) && (
        <div role="status" className="rounded-[var(--radius-kartu)] border border-garis p-3" data-testid="hasil-kuis" data-lulus={h.lulus}>
          <p className={h.lulus ? "text-daun" : ""}>{isiTeks(h.lulus ? t.lulus : t.belumLulus, { skor: h.skor, benar: h.benar, total: h.total, ambang: h.ambang })}</p>
          {h.sertifikat && <p className="mt-1"><Link href={`/sertifikat/${h.sertifikat}`} className="underline underline-offset-4">{isiTeks(t.lihatSertifikat, { nomor: h.nomor ?? "" })}</Link></p>}
        </div>
      )}
    </form>
  );
}
