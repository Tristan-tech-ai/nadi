"use client";

import { useActionState } from "react";
import { ajukanThr, type HasilThr } from "@/app/app/gaji/thr/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

export function FormAjukanThr({ hari, kunci, teks: t }: { hari: string; kunci: string; teks: Kamus["thr"] }) {
  const [h, aksi, sibuk] = useActionState<HasilThr, FormData>(ajukanThr, null);
  return (
    <form action={aksi} className="mt-4" aria-label={t.ajukanAria}>
      <input type="hidden" name="hari" value={hari} /><input type="hidden" name="kunci" value={kunci} />
      <Tombol type="submit" disabled={sibuk}>{t.ajukan}</Tombol>
      {h && ("galat" in h ? <p role="alert" className="mt-2 text-cap">{h.galat}</p> : <p role="status" className="mt-2 text-daun">{h.pesan}</p>)}
    </form>
  );
}
