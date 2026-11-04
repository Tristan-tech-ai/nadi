"use client";

import { useActionState, useId } from "react";
import { putuskanLangkah, type HasilLangkah } from "@/app/app/langkah-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

/** M-11B: satu pengajuan yang menunggu atasan langsung (atau delegasinya). Menolak wajib alasan. */
export function KartuLangkah({ langkah, judul, teks: t }: { langkah: string; judul: string; teks: Kamus["survei"] }) {
  const [h, aksi, sibuk] = useActionState<HasilLangkah, FormData>(putuskanLangkah, null);
  const id = useId();
  if (h && "pesan" in h) return <p role="status" className="mt-2 text-daun">{h.pesan}</p>;
  return (
    <form action={aksi} className="mt-2 flex flex-col gap-2 text-sm" aria-label={`${t.putuskanAria}: ${judul}`}>
      <input type="hidden" name="langkah" value={langkah} />
      <label htmlFor={`${id}c`} className="text-tinta-2">{t.catatanTolak}</label>
      <input id={`${id}c`} name="catatan" maxLength={300} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" />
      <div className="flex flex-wrap gap-2">
        <Tombol type="submit" name="setuju" value="1" disabled={sibuk}>{t.setujui}</Tombol>
        <Tombol type="submit" name="setuju" value="0" ragam="kedua" disabled={sibuk}>{t.tolak}</Tombol>
      </div>
      {h && "galat" in h && <p role="alert" className="text-cap">{h.galat}</p>}
    </form>
  );
}
