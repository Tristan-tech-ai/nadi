"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { pindahkan, type HasilPindah } from "@/app/app/pindah/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

export function FormPindah({ teks: t }: { teks: Kamus["pindah"] }) {
  const [h, aksi, sibuk] = useActionState<HasilPindah, FormData>(pindahkan, null);
  const id = useId();
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.formJudul}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-tinta-2">{t.berkas}</label>
        <input id={id} name="berkas" type="file" required accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-base file:mr-3 file:h-10 file:rounded-[var(--radius-isian)] file:border file:border-garis-kuat file:bg-kertas file:px-3" />
        <p className="text-xs text-tinta-2">{t.berkasKet}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" disabled={sibuk}>{sibuk ? t.membaca : t.kirim}</Tombol>
        {h && "galat" in h && <p role="alert" className="w-full text-cap">{h.galat}</p>}
        {h && "pesan" in h && <p role="status" className="w-full text-daun">{h.pesan} <Link href="/app" className="underline underline-offset-4">{t.keFeed}</Link></p>}
      </div>
    </form>
  );
}
