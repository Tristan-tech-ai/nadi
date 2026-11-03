"use client";

import { useActionState, useRef } from "react";
import { buatLowongan, type HasilLowongan } from "@/app/app/lowongan-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

export function FormLowongan({ topi, teks: t }: { topi: { id: string; nama: string }[]; teks: Kamus["lowongan"] }) {
  // Q-16: satu kunci per isian; kiriman ulang (experimental.useOffline) membawa kunci yang sama sehingga tidak ada lowongan kembar.
  const kunci = useRef<string | null>(null);
  const [h, aksi, sibuk] = useActionState<HasilLowongan, FormData>(async (lalu, fd) => {
    kunci.current ??= crypto.randomUUID();
    fd.set("kunci", kunci.current);
    const r = await buatLowongan(lalu, fd);
    if (r && "pesan" in r) kunci.current = null;
    return r;
  }, null);
  return (
    <form action={aksi} className="mt-4 grid gap-2 sm:grid-cols-2" aria-label={t.formAria}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.judulLowongan}</span>
        <input name="judul" required maxLength={120} placeholder={t.judulContoh} className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.topi}</span>
        <select name="topi" className={isian} defaultValue="">
          <option value="">{t.tanpaTopi}</option>
          {topi.map((x) => <option key={x.id} value={x.id} data-pengguna>{x.nama}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-tinta-2">{t.biaya}</span>
        <input name="biaya_iklan" inputMode="numeric" placeholder="0" className={isian} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-tinta-2">{t.ringkasan}</span>
        <textarea name="ringkasan" maxLength={1000} rows={2} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 py-2 text-base" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.membuat : t.buat}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>)}
      </div>
    </form>
  );
}
