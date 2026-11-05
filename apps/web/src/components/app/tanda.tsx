"use client";

import { useActionState, useId, type ReactNode } from "react";
import { batalTanda, kirimMassal, simpanKirim, simpanTemplatTanda, type HasilTanda, type Tautan } from "@/app/app/tanda-tangan/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { tautanWa } from "@/lib/katalog";
import { nomorWa } from "@/lib/tanda";

type T = Kamus["tanda"];
const isian = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 py-2 text-base";
const JENIS = ["perjanjian", "pernyataan", "kuitansi", "lain"] as const;

function Kolom({ label, children, lebar }: { label: string; children: (id: string) => ReactNode; lebar?: boolean }) {
  const id = useId();
  return <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{children(id)}</div>;
}

/** Tautan sekali tampil: disalin atau dibagikan sendiri lewat wa.me (Nadi tidak mengirim pesan). */
function DaftarTautan({ tautan, asal, t }: { tautan: Tautan[]; asal: string; t: T }) {
  return (
    <div className="col-span-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-3" data-testid="tautan-tanda">
      <p className="font-semibold">{t.tautanJudul}</p>
      <p className="text-xs text-tinta-2">{t.tautanKet}</p>
      <ul className="mt-2 space-y-2">
        {tautan.map((x) => {
          const url = `${asal}/tanda/${x.token}`;
          const wa = nomorWa(x.kontak);
          const kirim = wa ? tautanWa(wa, `${x.nama}, mohon tanda tangani dokumen ini: ${url}`) : null;
          return (
            <li key={x.token} data-nama={x.nama}>
              <p className="text-sm">{isiTeks(t.salin, { nama: x.nama })}</p>
              <a href={url} className="break-all text-sm text-laut underline underline-offset-2" data-testid="tautan-penanda">{url}</a>
              {kirim && <a href={kirim} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm font-semibold text-laut underline underline-offset-2">{t.bagikanWa}</a>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-tinta-2">{isiTeks(t.kodeCek, { kode: tautan[0]?.kode ?? "" })}</p>
    </div>
  );
}

function Hasil({ h, asal, t }: { h: HasilTanda; asal: string; t: T }) {
  if (!h) return null;
  if ("galat" in h) return <p role="alert" className="col-span-2 text-sm text-cap">{h.galat}</p>;
  return <><p role="status" className="col-span-2 text-sm text-daun">{h.pesan}</p>{h.tautan && h.tautan.length > 0 && <DaftarTautan tautan={h.tautan} asal={asal} t={t} />}</>;
}

export function FormDokumen({ asal, teks: t }: { asal: string; teks: T }) {
  const [h, kirim, sibuk] = useActionState<HasilTanda, FormData>(simpanKirim, null);
  return (
    <form action={kirim} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.buatJudul}>
      <Kolom label={t.judulDok} lebar>{(id) => <input id={id} name="judul" required minLength={3} maxLength={150} className={isian} />}</Kolom>
      <Kolom label={t.jenis}>{(id) => <select id={id} name="jenis" defaultValue="perjanjian" className={isian}>{JENIS.map((j) => <option key={j} value={j}>{t.jenisNama[j]}</option>)}</select>}</Kolom>
      <Kolom label={t.nilai}>{(id) => <input id={id} name="nilai" inputMode="numeric" className={`${isian} angka`} />}</Kolom>
      <Kolom label={t.isi} lebar>{(id) => <textarea id={id} name="isi" required minLength={10} maxLength={20000} rows={6} className={isian} />}</Kolom>
      <Kolom label={t.penanda} lebar>{(id) => <textarea id={id} name="penanda" required rows={3} placeholder={t.contohPenanda} className={isian} />}</Kolom>
      <Kolom label={t.berakhir}>{(id) => <input id={id} type="date" name="berakhir" className={isian} />}</Kolom>
      <Kolom label={t.berlaku}>{(id) => <input id={id} name="berlaku" inputMode="numeric" defaultValue="14" className={`${isian} angka`} />}</Kolom>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="cap" className="h-5 w-5" /><span>{t.cap}</span></label>
      <div className="col-span-2"><Tombol type="submit" disabled={sibuk}>{t.simpanKirim}</Tombol></div>
      <Hasil h={h} asal={asal} t={t} />
    </form>
  );
}

export function FormTemplatTanda({ teks: t }: { teks: T }) {
  const [h, kirim, sibuk] = useActionState<HasilTanda, FormData>(simpanTemplatTanda, null);
  return (
    <form action={kirim} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.simpanTemplat}>
      <Kolom label={t.judulDok} lebar>{(id) => <input id={id} name="judul" required minLength={3} maxLength={150} placeholder="Pernyataan kerahasiaan {nama}" className={isian} />}</Kolom>
      <Kolom label={t.jenis}>{(id) => <select id={id} name="jenis" defaultValue="pernyataan" className={isian}>{JENIS.map((j) => <option key={j} value={j}>{t.jenisNama[j]}</option>)}</select>}</Kolom>
      <div />
      <Kolom label={t.isi} lebar>{(id) => <textarea id={id} name="isi" required minLength={10} maxLength={20000} rows={4} className={isian} />}</Kolom>
      <div className="col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanTemplat}</Tombol></div>
      <Hasil h={h} asal="" t={t} />
    </form>
  );
}

export function FormMassal({ templat, asal, teks: t }: { templat: { id: string; judul: string }[]; asal: string; teks: T }) {
  const [h, kirim, sibuk] = useActionState<HasilTanda, FormData>(kirimMassal, null);
  return (
    <form action={kirim} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.kirimMassal}>
      <Kolom label={t.pilihTemplat} lebar>{(id) => <select id={id} name="templat" required defaultValue="" className={isian}><option value="" disabled>{t.pilihTemplat}</option>{templat.map((x) => <option key={x.id} value={x.id} data-pengguna>{x.judul}</option>)}</select>}</Kolom>
      <Kolom label={t.penerima} lebar>{(id) => <textarea id={id} name="penerima" required rows={3} placeholder={t.contohPenanda} className={isian} />}</Kolom>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="cap" className="h-5 w-5" /><span>{t.cap}</span></label>
      <div className="col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.kirimMassal}</Tombol></div>
      <Hasil h={h} asal={asal} t={t} />
    </form>
  );
}

export function TombolBatalTanda({ id, label, teks }: { id: string; label: string; teks: string }) {
  const [h, kirim, sibuk] = useActionState<HasilTanda, FormData>(batalTanda, null);
  return (
    <form action={kirim} className="inline-flex flex-col items-start gap-1" aria-label={label}>
      <input type="hidden" name="id" value={id} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{teks}</Tombol>
      {h && "galat" in h && <p role="alert" className="text-sm text-cap">{h.galat}</p>}
    </form>
  );
}
