"use client";

import { useActionState, useId } from "react";
import { simpanDivisi, type HasilDivisi } from "@/app/app/orang/divisi-actions";
import { terimaHasil, type HasilKerja } from "@/app/app/kerja/actions";
import { MintaRevisi } from "@/components/app/kerja-tim";
import { Tombol } from "@/components/ui/tombol";
import { TEKS_DIVISI, type TeksDivisi } from "@/components/app/divisi-teks";

// X-13 divisi (halaman Orang) dan review kerja anggota untuk kepala divisi (halaman Kerja).
type Opsi = { id: string; nama: string };
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Pesan({ h }: { h: HasilDivisi | HasilKerja }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}

export function FormDivisi({ orang, awal, teks: t = TEKS_DIVISI.id }: { orang: Opsi[]; awal?: { id: string; nama: string; kepala: string | null; anggota: string[] }; teks?: TeksDivisi }) {
  const [h, kirim, sibuk] = useActionState<HasilDivisi, FormData>(simpanDivisi, null);
  const id = useId();
  const label = awal ? `${t.ubah} ${awal.nama}` : t.buat;
  return (
    <form action={kirim} className="grid gap-3 text-sm sm:grid-cols-2" aria-label={label} key={!awal && h && "pesan" in h ? h.pesan : "f"}>
      {awal && <input type="hidden" name="id" value={awal.id} />}
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor={`${id}-n`} className="text-tinta-2">{t.nama}</label>
        <input id={`${id}-n`} name="nama" required minLength={2} maxLength={60} defaultValue={awal?.nama} className={isian} /></div>
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor={`${id}-k`} className="text-tinta-2">{t.kepalaLabel}</label>
        <select id={`${id}-k`} name="kepala" defaultValue={awal?.kepala ?? ""} className={isian}>
          <option value="">{t.tanpaKepala}</option>{orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}
        </select></div>
      <fieldset className="sm:col-span-2"><legend className="text-tinta-2">{t.anggotaLabel}</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{orang.map((o) => (
          <label key={o.id} className="inline-flex min-h-8 items-center gap-2">
            <input type="checkbox" name="anggota" value={o.id} defaultChecked={awal?.anggota.includes(o.id)} className="size-4" /><span data-pengguna>{o.nama}</span>
          </label>))}</div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam={awal ? "kedua" : "utama"} disabled={sibuk}>{awal ? t.simpan : t.buat}</Tombol><Pesan h={h} />
      </div>
    </form>
  );
}

export type ReviewKelola = { usulan: string; kerja: string; judul: string; oleh: string | null; tautan: string | null; catatan: string | null };

function TerimaHasil({ usulan, judul }: { usulan: string; judul: string }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(terimaHasil, null);
  if (h && "pesan" in h) return <p role="status" className="text-sm text-daun">{h.pesan}</p>;
  return (
    <form action={kirim} className="flex flex-wrap items-center gap-3" aria-label={`Terima hasil ${judul}`}>
      <input type="hidden" name="usulan" value={usulan} />
      <Tombol type="submit" disabled={sibuk}>Terima hasil</Tombol><Pesan h={h} />
    </form>
  );
}

export function DaftarReviewKelola({ daftar }: { daftar: ReviewKelola[] }) {
  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4" aria-labelledby="judul-review-divisi" data-testid="review-divisi">
      <h2 id="judul-review-divisi" className="font-semibold">Hasil yang menunggu tinjauanmu ({daftar.length})</h2>
      <p className="mt-1 text-sm text-tinta-2">Kamu kepala divisi atau koordinator kerja. Terima bila hasilnya sudah sesuai, atau minta revisi dengan alasannya.</p>
      <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm">
        {daftar.map((r) => (
          <li key={r.usulan} className="grid gap-2 py-3" data-review={r.judul}>
            <p><span className="font-semibold" data-pengguna>{r.judul}</span> <span className="text-tinta-2">dari <span data-pengguna>{r.oleh ?? "anggota"}</span></span></p>
            {r.tautan && <p><a href={r.tautan} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-laut underline underline-offset-4" data-pengguna>{r.tautan}</a></p>}
            {r.catatan && <p className="text-tinta-2" data-pengguna>{r.catatan}</p>}
            <div className="flex flex-wrap items-start gap-4"><TerimaHasil usulan={r.usulan} judul={r.judul} /><MintaRevisi usulan={r.usulan} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
