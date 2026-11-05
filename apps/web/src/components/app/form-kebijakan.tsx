"use client";

import { useActionState } from "react";
import { aturKebijakan, type HasilKebijakan } from "@/app/app/izin/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

export type Kebijakan = {
  jenis: string;
  otomatis: boolean;
  maks_hari_otomatis: number;
  butuh_bukti: boolean;
  maks_bersamaan: number | null;
  jatah_tahunan: number | null;
};

const angka = "h-10 w-24 shrink-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const centang = "size-5 accent-[var(--tinta)]";

/** Satu baris aturan untuk satu jenis izin. */
export function FormKebijakan({ jenis, label, awal, teks: t }: { jenis: string; label: string; awal: Kebijakan | null; teks: Kamus["kebijakanIzin"] }) {
  const [hasil, aksi, sibuk] = useActionState<HasilKebijakan, FormData>(aturKebijakan, null);
  return (
    <form action={aksi} className="rounded-[var(--radius-kartu)] border border-garis p-4" data-testid={`kebijakan-${jenis}`} aria-label={isiTeks(t.aria, { jenis: label.toLowerCase() })}>
      <input type="hidden" name="jenis" value={jenis} />
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{label}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="otomatis" defaultChecked={awal?.otomatis ?? false} className={centang} />
          {t.setujuiOtomatis}
        </label>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2">
          <span>{t.palingLama}</span>
          <input type="number" name="maks_hari" min={0} max={30} required defaultValue={awal?.maks_hari_otomatis ?? 1} className={angka} />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>{t.bersamaan}</span>
          <input type="number" name="maks_bersamaan" min={0} max={1000} placeholder={t.bebas} defaultValue={awal?.maks_bersamaan ?? ""} className={angka} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="butuh_bukti" defaultChecked={awal?.butuh_bukti ?? jenis === "sakit"} className={centang} />
          {t.wajibBukti}
        </label>
        {jenis === "cuti" && (
          <label className="flex items-center justify-between gap-2">
            <span>{t.jatah}</span>
            <input type="number" name="jatah" min={0} max={60} placeholder={t.tidakDihitung} defaultValue={awal?.jatah_tahunan ?? ""} className={angka} />
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpan}<span className="sr-only"> {label.toLowerCase()}</span></Tombol>
        {hasil && "tersimpan" in hasil && <p role="status" className="text-sm text-daun">{hasil.tersimpan}</p>}
        {hasil && "galat" in hasil && <p role="alert" className="text-sm text-cap">{hasil.galat}</p>}
      </div>
    </form>
  );
}
