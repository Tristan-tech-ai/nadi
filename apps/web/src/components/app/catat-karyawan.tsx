"use client";

import { useActionState } from "react";
import { catatKaryawan, type HasilKeputusan } from "@/app/app/tahap-actions";
import { Tombol } from "@/components/ui/tombol";

/** F2-07: catat pelamar yang diterima sebagai karyawan, supaya kinerjanya nanti bisa dibandingkan dengan nilai seleksinya. */
export function CatatKaryawan({ lamaran, nama, hari }: { lamaran: string; nama: string; hari: string }) {
  const [h, aksi, sibuk] = useActionState<HasilKeputusan, FormData>(catatKaryawan, null);
  return (
    <form action={aksi} className="mt-4 flex flex-col gap-2 border-t border-garis pt-3 text-sm" aria-label={`Catat ${nama} sebagai karyawan`} data-testid="catat-karyawan">
      <p>{nama} sudah diterima. Catat sebagai karyawan supaya masuk daftar orang, mendapat topi lowongan ini, dan kinerjanya nanti dibandingkan dengan nilai seleksinya.</p>
      <input type="hidden" name="lamaran" value={lamaran} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Mulai kerja</span>
          <input type="date" name="mulai" required defaultValue={hari} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Mencatat..." : "Catat sebagai karyawan"}</Tombol>
      </div>
      {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}
    </form>
  );
}
