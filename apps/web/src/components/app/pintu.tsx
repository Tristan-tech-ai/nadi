"use client";

import { useActionState } from "react";
import { buatPintu, cabutPintu, type HasilPintu } from "@/app/app/pintu-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["pintu"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h, teks: t }: { h: HasilPintu; teks: Teks }) {
  if (!h) return null;
  if ("galat" in h) return <p role="alert" className="w-full text-cap">{h.galat}</p>;
  return (
    <div role="status" className="w-full">
      <p className="text-daun">{h.pesan}</p>
      {h.token && (
        <>
          <p className="mt-2 text-tinta-2">{t.tokenSekali}</p>
          <p className="mt-1 break-all rounded-[var(--radius-isian)] bg-kertas-2 p-2 font-mono text-tinta" data-testid="token-pintu">{h.token}</p>
        </>
      )}
    </div>
  );
}

export function FormBuatPintu({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilPintu, FormData>(buatPintu, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.buatAria}>
      <label className="flex min-w-0 max-w-full flex-col gap-1"><span className="text-tinta-2">{t.nama}</span>
        <input name="nama" required minLength={2} maxLength={60} placeholder={t.namaContoh} className={`${isian} w-56 max-w-full`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.batas}</span>
        <input name="batas" defaultValue={100} inputMode="numeric" className={`${isian} angka w-24 text-right`} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.buat}</Tombol>
      <Hasil h={h} teks={t} />
    </form>
  );
}

export function TombolCabutPintu({ id, nama, teks: t }: { id: string; nama: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilPintu, FormData>(cabutPintu, null);
  return (
    <form action={aksi} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={sibuk} aria-label={`${t.cabut} ${nama}`}
        className="h-10 rounded-[var(--radius-isian)] border border-cap px-3 text-sm font-semibold text-cap transition-[background-color,color] duration-150 hover:bg-cap hover:text-kertas disabled:opacity-50">
        {t.cabut}
      </button>
      {h && "galat" in h && <p role="alert" className="text-sm text-cap">{h.galat}</p>}
    </form>
  );
}
