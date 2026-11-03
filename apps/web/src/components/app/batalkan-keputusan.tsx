"use client";

import { useActionState, useState } from "react";
import { batalkanKeputusan, type HasilBatal } from "@/app/app/keputusan-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

/** Tombol batal dengan alasan wajib; formulir alasan baru muncul setelah ditekan. */
export function BatalkanKeputusan({ id, teks: t }: { id: string; teks: Kamus["keputusanOto"] }) {
  const [buka, setBuka] = useState(false);
  const [h, aksi, sibuk] = useActionState<HasilBatal, FormData>(batalkanKeputusan, null);
  if (h && "pesan" in h) return <p role="status" className="mt-1 text-daun">{h.pesan}</p>;
  if (!buka) return <Tombol ragam="teks" className="-ml-2 mt-1" onClick={() => setBuka(true)}>{t.batalkan}</Tombol>;
  return (
    <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-tinta-2">{t.alasanLabel}</span>
        <input name="alasan" required maxLength={200} autoFocus placeholder={t.alasanContoh} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
      </label>
      <Tombol type="submit" ragam="bahaya" disabled={sibuk}>{sibuk ? t.membatalkan : t.batalkanKeputusan}</Tombol>
      {h && "galat" in h && <p role="alert" className="w-full text-cap">{h.galat}</p>}
    </form>
  );
}
