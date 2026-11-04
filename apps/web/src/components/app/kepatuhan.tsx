"use client";

import { useActionState, useId } from "react";
import { simpanIzinUsaha, type HasilIzinUsaha } from "@/app/app/kepatuhan/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

export function FormIzinUsaha({ teks: t }: { teks: Kamus["kepatuhan"] }) {
  const [h, aksi, sibuk] = useActionState<HasilIzinUsaha, FormData>(simpanIzinUsaha, null);
  const id = useId();
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.izinAria}>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}j`} className="text-tinta-2">{t.jenis}</label>
        <select id={`${id}j`} name="jenis" defaultValue="pirt" className={isian}>{(Object.keys(t.jenisNama) as (keyof Kamus["kepatuhan"]["jenisNama"])[]).map((k) => <option key={k} value={k}>{t.jenisNama[k]}</option>)}</select></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}n`} className="text-tinta-2">{t.nama}</label><input id={`${id}n`} name="nama" required minLength={2} maxLength={80} placeholder={t.namaContoh} className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}o`} className="text-tinta-2">{t.nomor}</label><input id={`${id}o`} name="nomor" maxLength={60} className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}s`} className="text-tinta-2">{t.berlakuSampai}</label><input id={`${id}s`} type="date" name="berlaku_sampai" className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={`${id}p`} className="text-tinta-2">{t.pengingat}</label><input id={`${id}p`} type="number" name="pengingat" min={7} max={365} defaultValue={60} className={isian} /></div>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpan}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}</div>
    </form>
  );
}
