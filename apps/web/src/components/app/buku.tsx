"use client";

import { useActionState } from "react";
import { simpanSaldoAwal, tutupBuku, type HasilBuku } from "@/app/app/buku/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["buku"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilBuku }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}

/** Saldo awal: satu isian rupiah per akun neraca. Nama akun adalah data usaha (bagan akun bisa diubah), jadi ditandai data-pengguna. */
export function FormSaldoAwal({ akun, hariIni, teks: t }: { akun: { kode: string; nama: string; saldo_normal: string; golongan: string }[]; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBuku, FormData>(simpanSaldoAwal, null);
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label={t.saldoAwalJudul} data-testid="form-saldo-awal">
      <label className="flex max-w-xs flex-col gap-1"><span className="text-tinta-2">{t.tanggalMulai}</span>
        <input type="date" name="tanggal" required max={hariIni} defaultValue={`${hariIni.slice(0, 4)}-01-01`} className={isian} /></label>
      <ul className="divide-y divide-garis border-y border-garis">
        {akun.map((a) => (
          <li key={a.kode} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <label htmlFor={`saldo-${a.kode}`} className="min-w-0 flex-1"><span className="angka text-tinta-2">{a.kode}</span> <span data-pengguna>{a.nama}</span></label>
            <input id={`saldo-${a.kode}`} name={`saldo:${a.kode}:${a.saldo_normal}`} inputMode="numeric" placeholder="0" className={`${isian} angka w-40 text-right`} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanSaldo}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

export function FormTutupBuku({ tahun, teks: t }: { tahun: number; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilBuku, FormData>(tutupBuku, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-center gap-3 text-sm" aria-label={t.tutupJudul}>
      <input type="hidden" name="tahun" value={tahun} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{isiTeks(t.tutupTahun, { tahun })}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function TombolCetak({ label }: { label: string }) {
  return <Tombol type="button" ragam="kedua" onClick={() => window.print()} className="print:hidden">{label}</Tombol>;
}
