"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useActionState, useId, useState } from "react";
import { ajukanGeserTenggat, aturButir, aturTim, kirimHasil, mintaRevisi, type HasilKerja } from "@/app/app/kerja/actions";
import { Tombol } from "@/components/ui/tombol";

// X-10 kerja tim: pengelola mengatur pelaksana + porsi + PIC; pengelola dan pelaksana mengisi checklist satu tingkat.
type Opsi = { id: string; nama: string };
export type Butir = { id: string; judul: string; selesai: boolean };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilKerja }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}

export function AturTim({ kerja, judul, orang, awal, en = false }: { kerja: string; judul: string; orang: Opsi[]; awal: { id: string; porsi: number; pic: boolean }[]; en?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(aturTim, null);
  // Q-50: porsi disimpan sebagai teks selama diketik (isian kosong tetap kosong, tidak menjadi 0 lalu 060); angka hanya untuk jumlah.
  const [baris, setBaris] = useState(awal.length ? awal.map((x) => ({ ...x, porsi: String(x.porsi) })) : [{ id: "", porsi: "100", pic: true }]);
  const awalan = useId();
  const jumlah = baris.reduce((a, x) => a + (Number(x.porsi) || 0), 0);
  const ubah = (i: number, isi: Partial<(typeof baris)[number]>) => setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)));
  return (
    <form action={kirim} className="grid gap-2 text-sm" aria-label={en ? `Team for ${judul}` : `Tim untuk ${judul}`}>
      <input type="hidden" name="kerja" value={kerja} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-semibold">{en ? "Team and share" : "Tim dan porsi"}</legend>
        {baris.map((x, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2" data-baris-tim={i}>
            <label className="sr-only" htmlFor={`${awalan}-o${i}`}>{en ? `Person ${i + 1}` : `Orang ${i + 1}`}</label>
            <select id={`${awalan}-o${i}`} name={`orang_${i}`} value={x.id} onChange={(e) => ubah(i, { id: e.target.value })} className={`${isian} min-w-40 flex-1`}>
              <option value="">{en ? "Choose" : "Pilih orang"}</option>
              {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
            <label className="flex items-center gap-1">
              <span className="sr-only">{en ? `Share of person ${i + 1}` : `Porsi orang ${i + 1}`}</span>
              <input name={`porsi_${i}`} type="number" min={1} max={100} value={x.porsi} onChange={(e) => ubah(i, { porsi: e.target.value })} className={`${isian} angka w-20`} />
              <span aria-hidden>%</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="pic" value={x.id} checked={x.pic} onChange={() => setBaris((b) => b.map((y, j) => ({ ...y, pic: j === i })))} className="size-4" />
              PIC
            </label>
            {baris.length > 1 && (
              <button type="button" onClick={() => setBaris((b) => b.filter((_, j) => j !== i))} className="text-sm underline underline-offset-4">
                {en ? "Remove" : "Hapus"}<span className="sr-only"> {en ? `person ${i + 1}` : `orang ${i + 1}`}</span>
              </button>
            )}
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {baris.length < 10 && <button type="button" onClick={() => setBaris((b) => [...b, { id: "", porsi: String(Math.max(0, 100 - b.reduce((a, x) => a + (Number(x.porsi) || 0), 0))), pic: false }])} className="underline underline-offset-4">{en ? "Add person" : "Tambah orang"}</button>}
        <span className={`angka ${jumlah === 100 ? "text-tinta-2" : "text-cap"}`} data-testid="jumlah-porsi">{en ? "Total" : "Jumlah"} {jumlah}%</span>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "..." : en ? "Save team" : "Simpan tim"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

function CentangButir({ b }: { b: Butir }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(aturButir, null);
  return (
    <form action={kirim} className="flex items-center gap-2" data-butir={b.id}>
      <input type="hidden" name="aksi" value="centang" />
      <input type="hidden" name="butir" value={b.id} />
      <input type="hidden" name="selesai" value={b.selesai ? "tidak" : "ya"} />
      <button type="submit" disabled={sibuk} aria-pressed={b.selesai} className="inline-flex min-h-10 items-center gap-2 text-left">
        <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded border ${b.selesai ? "border-daun bg-daun text-kertas" : "border-garis-kuat"}`}>{b.selesai && <CheckIcon size={14} weight="bold" />}</span>
        <span className={b.selesai ? "text-tinta-2 line-through" : ""} data-pengguna>{b.judul}</span>
      </button>
      {h && "galat" in h && <Hasil h={h} />}
    </form>
  );
}

export function ChecklistKerja({ kerja, judul, butir, en = false }: { kerja: string; judul: string; butir: Butir[]; en?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(aturButir, null);
  const id = useId();
  const selesai = butir.filter((b) => b.selesai).length;
  return (
    <div className="grid gap-1 text-sm" data-testid="checklist-kerja">
      <p className="font-semibold">{en ? "Checklist" : "Checklist"} <span className="angka font-normal text-tinta-2">{selesai}/{butir.length}</span></p>
      {butir.length > 0 && <ul className="grid">{butir.map((b) => <li key={b.id}><CentangButir b={b} /></li>)}</ul>}
      <form action={kirim} className="flex flex-wrap items-center gap-2" aria-label={en ? `Add checklist item to ${judul}` : `Tambah butir ke ${judul}`} key={h && "pesan" in h ? h.pesan + butir.length : "f"}>
        <input type="hidden" name="aksi" value="tambah" />
        <input type="hidden" name="kerja" value={kerja} />
        <label htmlFor={id} className="sr-only">{en ? "New item" : "Butir baru"}</label>
        <input id={id} name="judul" required maxLength={200} placeholder={en ? "New item" : "Butir baru, mis. Cek di HP"} className={`${isian} min-w-48 flex-1`} />
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{en ? "Add" : "Tambah butir"}</Tombol>
        {h && "galat" in h && <Hasil h={h} />}
      </form>
    </div>
  );
}

/** X-11: kirim hasil (tautan dan/atau catatan) saat kerja jalan. */
export function KirimHasil({ kerja, en = false }: { kerja: string; en?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(kirimHasil, null);
  const id = useId();
  return (
    <form action={kirim} className="grid gap-2 text-sm" aria-label={en ? "Send result" : "Kirim hasil"} data-testid="kirim-hasil">
      <input type="hidden" name="kerja" value={kerja} />
      <label htmlFor={`${id}-t`} className="text-tinta-2">{en ? "Result link" : "Tautan hasil"}</label>
      <input id={`${id}-t`} name="tautan" type="url" placeholder="https://" maxLength={2000} className={isian} />
      <label htmlFor={`${id}-c`} className="text-tinta-2">{en ? "Short note" : "Catatan singkat"}</label>
      <textarea id={`${id}-c`} name="catatan" rows={2} maxLength={2000} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" />
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" disabled={sibuk}>{en ? "Send for review" : "Kirim untuk review"}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

/** X-11: ajukan geser tenggat dengan alasan (tenggat awal tetap tercatat). */
export function AjukanGeser({ kerja, en = false }: { kerja: string; en?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(ajukanGeserTenggat, null);
  const id = useId();
  return (
    <details className="text-sm" data-testid="ajukan-geser">
      <summary className="cursor-pointer font-semibold">{en ? "Ask to move the deadline" : "Ajukan geser tenggat"}</summary>
      <form action={kirim} className="mt-2 grid gap-2" aria-label={en ? "Ask to move the deadline" : "Ajukan geser tenggat"}>
        <input type="hidden" name="kerja" value={kerja} />
        <label htmlFor={`${id}-w`} className="text-tinta-2">{en ? "New deadline" : "Tenggat baru"}</label>
        <input id={`${id}-w`} name="tenggat" type="datetime-local" required className={isian} />
        <label htmlFor={`${id}-a`} className="text-tinta-2">{en ? "Reason" : "Alasan"}</label>
        <input id={`${id}-a`} name="alasan" required minLength={5} maxLength={500} className={isian} />
        <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{en ? "Send request" : "Kirim pengajuan"}</Tombol><Hasil h={h} /></div>
      </form>
    </details>
  );
}

/** X-11: minta revisi beralasan di kartu Feed hasil kerja. */
export function MintaRevisi({ usulan, en = false }: { usulan: string; en?: boolean }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(mintaRevisi, null);
  const id = useId();
  if (h && "pesan" in h) return <p role="status" className="text-sm text-daun">{h.pesan}</p>;
  return (
    <details className="text-sm" data-testid="minta-revisi">
      <summary className="cursor-pointer font-semibold">{en ? "Ask for revision" : "Minta revisi"}</summary>
      <form action={kirim} className="mt-2 grid gap-2" aria-label={en ? "Ask for revision" : "Minta revisi"}>
        <input type="hidden" name="usulan" value={usulan} />
        <label htmlFor={id} className="text-tinta-2">{en ? "What needs fixing" : "Yang perlu diperbaiki"}</label>
        <textarea id={id} name="alasan" required minLength={5} maxLength={500} rows={2} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" />
        <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{en ? "Send revision request" : "Kirim permintaan revisi"}</Tombol><Hasil h={h} /></div>
      </form>
    </details>
  );
}
