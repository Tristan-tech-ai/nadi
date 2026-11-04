"use client";

import { useActionState } from "react";
import { beriKasbon, type HasilKasbon } from "@/app/app/gaji/kasbon/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

export function FormKasbon({ orang, kunci, teks: t }: { orang: { id: string; nama: string }[]; kunci: string; teks: Kamus["kasbon"] }) {
  const [h, aksi, sibuk] = useActionState<HasilKasbon, FormData>(beriKasbon, null);
  return (
    <form action={aksi} className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-label={t.formAria}>
      <input type="hidden" name="kunci" value={kunci} />
      <label className="col-span-2 flex flex-col gap-1"><span className="text-tinta-2">{t.orang}</span>
        <select name="orang" required defaultValue="" className={isian}>
          <option value="" disabled>{t.pilihOrang}</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jumlah}</span>
        <input name="jumlah" inputMode="numeric" required className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.cicilan}</span>
        <input name="cicilan" inputMode="numeric" required className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.cara}</span>
        <select name="cara" defaultValue="tunai" className={isian}>
          <option value="tunai">{t.tunai}</option><option value="transfer">{t.transfer}</option>
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span>
        <input name="alasan" required minLength={3} maxLength={300} placeholder={t.alasanContoh} className={isian} /></label>
      <div className="col-span-2 flex flex-col items-start gap-2">
        <Tombol type="submit" disabled={sibuk}>{sibuk ? t.menyimpan : t.beri}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}
      </div>
    </form>
  );
}
