"use client";

import { useActionState } from "react";
import { buatPerusahaan } from "@/app/app/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const JENIS = ["fnb", "toko", "kantor", "bengkel", "klinik", "konstruksi", "logistik", "hotel", "salon", "laundry", "lainnya"] as const;

export function FormMulai({ teks: t }: { teks: Kamus["mulai"] }) {
  const [hasil, kirim, menunggu] = useActionState(buatPerusahaan, {});
  return (
    <form action={kirim} className="grid gap-5">
      <div>
        <label htmlFor="nama" className="text-sm font-medium">{t.nama}</label>
        <input id="nama" name="nama" required minLength={2} maxLength={120} defaultValue={hasil.isian?.nama} placeholder={t.namaContoh}
          className="mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2" />
        <p className="mt-1 text-xs text-tinta-2">{t.namaBantu}</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t.jenis}</legend>
        <p className="text-xs text-tinta-2">{t.jenisBantu}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {JENIS.map((kode) => (
            <label key={kode} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
              <input type="radio" name="industri" value={kode} defaultChecked={(hasil.isian?.industri ?? "fnb") === kode} className="accent-[var(--tinta)]" />
              <span className="text-sm">{t[kode]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? t.menyiapkan : t.siapkan}</Tombol>
    </form>
  );
}
