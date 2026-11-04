"use client";

import { useActionState } from "react";
import { batalkan, pahami, simpanDraf, terbitkan, type DrafSurat, type HasilPaham, type HasilSurat } from "@/app/app/surat-keluar/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { JENIS_SURAT, type JenisSurat } from "@/lib/surat/kalimat";

type Teks = Kamus["suratKeluar"];

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSurat | HasilPaham }) {
  if (!h || !("galat" in h || "pesan" in h)) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

function FormDraf({ draf, orang, teks: t }: { draf: DrafSurat; orang: { id: string; nama: string }[]; teks: Teks }) {
  const namaJenis: Record<JenisSurat, string> = { sk_mutasi: t.jSkMutasi, surat_tugas: t.jSuratTugas, keterangan_kerja: t.jKeteranganKerja };
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(simpanDraf, null);
  const ragu = draf.kandidat.length > 1 && !draf.orang;
  return (
    <form action={aksi} className="mt-4 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.isianAria}>
      {draf.kurang.length > 0 && (
        <p className="sm:col-span-2" data-testid="isian-kurang">
          {draf.kurang.length === 1 ? t.kurangSatu : isiTeks(t.kurangBanyak, { n: draf.kurang.length })}
          {ragu && <span data-pengguna>{isiTeks(t.mirip, { n: draf.kandidat.length, nama: draf.kandidat.map((k) => k.nama).join(", ") })}</span>}
        </p>
      )}
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jenis}</span>
        <select name="jenis" required defaultValue={draf.jenis} className={isian}>
          <option value="" disabled>{t.pilih}</option>
          {(Object.keys(JENIS_SURAT) as JenisSurat[]).map((j) => <option key={j} value={j}>{namaJenis[j]}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.untukSiapa}</span>
        <select name="orang" required defaultValue={draf.orang} className={isian}>
          <option value="" disabled>{t.pilihOrang}</option>
          {orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tujuan}</span>
        <input name="tujuan" defaultValue={draf.tujuan} maxLength={120} placeholder={t.tujuanContoh} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.keperluan}</span>
        <input name="keperluan" defaultValue={draf.keperluan} maxLength={200} placeholder={t.keperluanContoh} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.mulai}</span>
        <input type="date" name="mulai" defaultValue={draf.mulai} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.lama}</span>
        <input type="number" name="lamaHari" min={1} max={365} defaultValue={draf.lamaHari} inputMode="numeric" className={isian} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpanDraf}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

/** Kalimat bebas lalu isian surat yang bisa diperiksa sebelum disimpan sebagai draf. */
export function BuatSurat({ orang, teks: t }: { orang: { id: string; nama: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilPaham, FormData>(pahami, null);
  return (
    <div>
      <form action={aksi} className="flex flex-col gap-2" aria-label={t.mintaAria}>
        <label htmlFor="kalimat-surat" className="text-sm text-tinta-2">{t.kalimatLabel}</label>
        <textarea id="kalimat-surat" name="kalimat" required rows={2} maxLength={300}
          placeholder={t.kalimatContoh}
          className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base" />
        <div className="flex flex-wrap items-center gap-3">
          <Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? t.membaca : t.susun}</Tombol>
          {h && "galat" in h && <Hasil h={h} />}
        </div>
      </form>
      {h && "draf" in h && <FormDraf key={h.kunci} draf={h.draf} orang={orang} teks={t} />}
    </div>
  );
}

export function FormTerbitkan({ surat, judul, teks: t }: { surat: string; judul: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(terbitkan, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-3 text-sm">
      <input type="hidden" name="surat" value={surat} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={isiTeks(t.terbitkanAria, { judul })}>{sibuk ? t.menerbitkan : t.terbitkan}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalSurat({ surat, judul, teks: t }: { surat: string; judul: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(batalkan, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2">{t.batalkanSurat}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={isiTeks(t.batalAria, { judul })}>
        <input type="hidden" name="surat" value={surat} />
        <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span>
          <input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.batalkan}</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}

export function TombolCetak({ label = "Cetak atau simpan PDF" }: { label?: string }) {
  return <Tombol type="button" ragam="utama" onClick={() => window.print()} className="print:hidden">{label}</Tombol>;
}
