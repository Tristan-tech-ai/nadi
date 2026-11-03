"use client";

import { useActionState } from "react";
import Link from "next/link";
import { masukStaf } from "@/app/auth-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

const kelas = "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base uppercase tracking-wider text-tinta placeholder:normal-case placeholder:tracking-normal placeholder:text-tinta-2";

export function FormStaf({ teks: t }: { teks: Kamus["auth"] }) {
  const [hasil, kirim, menunggu] = useActionState(masukStaf, {});
  return (
    <form action={kirim} className="grid gap-4" noValidate>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div>
          <label htmlFor="kode" className="text-sm font-medium">{t.kodeUsaha}</label>
          <input id="kode" name="kode" required autoComplete="organization" maxLength={6} defaultValue={hasil.isian?.kode} placeholder={t.kodeContoh} className={`${kelas} font-mono`} />
        </div>
        <div>
          <label htmlFor="id" className="text-sm font-medium">{t.idKamu}</label>
          <input id="id" name="id" required autoComplete="username" maxLength={6} defaultValue={hasil.isian?.id} placeholder="S001" className={`${kelas} font-mono`} />
        </div>
      </div>
      <div>
        <label htmlFor="pin" className="text-sm font-medium">{t.pin}</label>
        <input id="pin" name="pin" required type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="current-password" className={kelas} />
      </div>
      {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? t.sebentar : t.masuk}</Tombol>
      <p className="text-sm text-tinta-2">
        {t.pemilikAdmin} <Link href="/masuk" className="font-semibold text-tinta underline underline-offset-4">{t.masukEmail}</Link>
      </p>
    </form>
  );
}
