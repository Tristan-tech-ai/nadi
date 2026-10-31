"use client";

import { useActionState } from "react";
import { buatLowongan, type HasilLowongan } from "@/app/app/lowongan-actions";
import { Tombol } from "@/components/ui/tombol";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

export function FormLowongan({ topi }: { topi: { id: string; nama: string }[] }) {
  const [h, aksi, sibuk] = useActionState<HasilLowongan, FormData>(buatLowongan, null);
  return (
    <form action={aksi} className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Buat lowongan">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Judul lowongan</span>
        <input name="judul" required maxLength={120} placeholder="Pelayan shift malam" className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Topi (posisi)</span>
        <select name="topi" className={isian} defaultValue="">
          <option value="">Tanpa topi</option>
          {topi.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">Biaya iklan (Rp, boleh kosong)</span>
        <input name="biaya_iklan" inputMode="numeric" placeholder="0" className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-tinta-2">Ringkasan tugas dan jam kerja (boleh kosong)</span>
        <textarea name="ringkasan" maxLength={1000} rows={2} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Membuat..." : "Buat lowongan"}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>)}
      </div>
    </form>
  );
}
