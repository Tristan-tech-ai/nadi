"use client";

import { useActionState, useId } from "react";
import { buatSurvei, isiSurvei, type HasilSurvei } from "@/app/app/survei/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["survei"];
export type Pertanyaan = { id: string; teks: string; jenis: "skala" | "pilihan" | "teks"; pilihan?: string[] | null };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
function Hasil({ h }: { h: HasilSurvei }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>;
}

function BarisPertanyaan({ i, t }: { i: number; t: T }) {
  const id = useId();
  return (
    <fieldset className="grid grid-cols-2 gap-2 border-t border-garis pt-3">
      <legend className="sr-only">{`${t.pertanyaan} ${i + 1}`}</legend>
      <div className="col-span-2 flex flex-col gap-1"><label htmlFor={`${id}t`} className="text-tinta-2">{`${t.pertanyaan} ${i + 1}`}</label><input id={`${id}t`} name={`teks${i}`} required={i === 0} maxLength={200} className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}j`} className="text-tinta-2">{t.jenis}</label>
        <select id={`${id}j`} name={`jenis${i}`} defaultValue="skala" className={isian}><option value="skala">{t.skala}</option><option value="pilihan">{t.pilihanSatu}</option><option value="teks">{t.teksBebas}</option></select></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}p`} className="text-tinta-2">{t.pilihanKoma}</label><input id={`${id}p`} name={`pilihan${i}`} maxLength={400} className={isian} /></div>
    </fieldset>
  );
}

export function FormBuatSurvei({ kunci, teks: t }: { kunci: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilSurvei, FormData>(buatSurvei, null);
  const id = useId();
  return (
    <form action={aksi} className="mt-3 flex flex-col gap-3 text-sm" aria-label={t.buatAria}>
      <input type="hidden" name="kunci" value={kunci} />
      <div className="flex flex-col gap-1"><label htmlFor={`${id}j`} className="text-tinta-2">{t.judul}</label><input id={`${id}j`} name="judul" required minLength={3} maxLength={120} className={isian} /></div>
      {[0, 1, 2, 3, 4].map((i) => <BarisPertanyaan key={i} i={i} t={t} />)}
      <label className="flex items-center gap-2"><input type="checkbox" name="anonim" defaultChecked className="size-5" /><span>{t.anonim}</span></label>
      <fieldset className="flex flex-wrap gap-4"><legend className="mb-1 text-tinta-2">{t.untuk}</legend>
        {(["staf", "admin", "akuntan"] as const).map((p) => <label key={p} className="flex items-center gap-2"><input type="checkbox" name="untuk" value={p} className="size-5" /><span>{t.peranNama[p]}</span></label>)}
      </fieldset>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}c`} className="text-tinta-2">{t.tutup}</label><input id={`${id}c`} type="date" name="tutup" className={isian} /></div>
      <div className="flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk}>{t.buat}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormIsiSurvei({ survei, judul, pertanyaan, anonim, teks: t }: { survei: string; judul: string; pertanyaan: Pertanyaan[]; anonim: boolean; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilSurvei, FormData>(isiSurvei, null);
  if (h && "pesan" in h) return <p role="status" className="mt-2 text-daun">{h.pesan}</p>;
  return (
    <form action={aksi} className="mt-3 flex flex-col gap-4 text-sm" aria-label={`${t.isiAria}: ${judul}`}>
      <input type="hidden" name="survei" value={survei} />
      <p className="text-xs text-tinta-2">{anonim ? t.ketAnonim : t.ketTidakAnonim}</p>
      {pertanyaan.map((q) => (
        <fieldset key={q.id} className="flex flex-col gap-2">
          <legend className="font-semibold">{q.teks}</legend>
          <input type="hidden" name={`jenis_${q.id}`} value={q.jenis} />
          {q.jenis === "teks" ? (
            <textarea name={q.id} maxLength={500} rows={3} aria-label={q.teks} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 py-2 text-base" />
          ) : (
            <div className="flex flex-wrap gap-3">
              {(q.jenis === "skala" ? ["1", "2", "3", "4", "5"] : (q.pilihan ?? [])).map((p) => (
                <label key={p} className="flex min-h-10 items-center gap-2">
                  <input type="radio" name={q.id} value={p} className="size-5" />
                  <span>{q.jenis === "skala" && p === "1" ? `1 ${t.skalaRendah}` : q.jenis === "skala" && p === "5" ? `5 ${t.skalaTinggi}` : p}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <div className="flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk}>{t.kirim}</Tombol><Hasil h={h} /></div>
    </form>
  );
}
