"use client";

import { useActionState } from "react";
import { catatKaryawan, type HasilKeputusan } from "@/app/app/tahap-actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { sisip } from "@/lib/i18n/sisip";
import type { Kamus } from "@/lib/i18n/kamus";

/** F2-07: catat pelamar yang diterima sebagai karyawan, supaya kinerjanya nanti bisa dibandingkan dengan nilai seleksinya. */
export function CatatKaryawan({ lamaran, nama, hari, teks: t }: { lamaran: string; nama: string; hari: string; teks: Kamus["wawancara"] }) {
  const [h, aksi, sibuk] = useActionState<HasilKeputusan, FormData>(catatKaryawan, null);
  return (
    <form action={aksi} className="mt-4 flex flex-col gap-2 border-t border-garis pt-3 text-sm" aria-label={isiTeks(t.catatAria, { nama })} data-testid="catat-karyawan">
      <p>{sisip(t.catatKet, { nama: <span data-pengguna>{nama}</span> })}</p>
      <input type="hidden" name="lamaran" value={lamaran} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.mulaiKerja}</span>
          <input type="date" name="mulai" required defaultValue={hari} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.mencatat : t.catat}</Tombol>
      </div>
      {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}
    </form>
  );
}
