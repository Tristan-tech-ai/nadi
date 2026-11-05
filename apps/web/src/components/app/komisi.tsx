"use client";

import { useActionState, useId } from "react";
import { simpanAturanKomisi, type HasilKomisi } from "@/app/app/gaji/komisi-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

export function FormKomisi({ produk, teks: t }: { produk: { id: string; nama: string }[]; teks: Kamus["komisi"] }) {
  const [h, aksi, sibuk] = useActionState<HasilKomisi, FormData>(simpanAturanKomisi, null);
  const id = { p: useId(), s: useId(), n: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={t.aturanJudul}>
      <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id.p} className="text-tinta-2">{t.produk}</label>
        <select id={id.p} name="produk" defaultValue="" className={isian}><option value="">{t.semua}</option>
          {produk.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.s} className="text-tinta-2">{t.persen}</label><input id={id.s} name="persen" inputMode="decimal" defaultValue="0" className={`${isian} angka`} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={id.n} className="text-tinta-2">{t.nominal}</label><input id={id.n} name="nominal" inputMode="numeric" defaultValue="0" className={`${isian} angka`} /></div>
      <p className="text-xs text-tinta-2 sm:col-span-3">{t.matikan}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpan}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}</div>
    </form>
  );
}
