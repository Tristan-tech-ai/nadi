"use client";

import { useActionState } from "react";
import { buatAkunStaf, tambahOrang } from "@/app/app/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const isian = "h-11 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2";

export function FormTambahOrang({ teks: t }: { teks: Kamus["orang"] }) {
  const [hasil, kirim, menunggu] = useActionState(tambahOrang, {});
  return (
    <form action={kirim} className="mt-6 flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="nama-orang" className="text-sm font-medium">{t.namaOrang}</label>
        <input id="nama-orang" name="nama" required minLength={2} placeholder="Ketut Wirawan" className={`${isian} mt-1 w-full`} />
      </div>
      <Tombol type="submit" ragam="kedua" disabled={menunggu}>{t.tambah}</Tombol>
      {hasil.galat ? <p role="alert" className="w-full text-sm text-cap">{hasil.galat}</p> : null}
    </form>
  );
}

export function FormAkunStaf({ orangId, sudahAda, teks: t }: { orangId: string; sudahAda: boolean; teks: Kamus["orang"] }) {
  const [hasil, kirim, menunggu] = useActionState(buatAkunStaf, {});
  return (
    <form action={kirim} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="orang" value={orangId} />
      <label className="sr-only" htmlFor={`pin-${orangId}`}>{t.pinLabel}</label>
      <input id={`pin-${orangId}`} name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder={t.pinLabel} className={`${isian} w-36 font-mono`} />
      <Tombol type="submit" ragam="kedua" disabled={menunggu}>{sudahAda ? t.gantiPin : t.buatAkun}</Tombol>
      {hasil.galat ? <p role="alert" className="w-full text-sm text-cap">{hasil.galat}</p> : null}
      {hasil.info ? <p role="status" className="w-full text-sm text-daun" data-testid="info-akun">{hasil.info}</p> : null}
    </form>
  );
}
