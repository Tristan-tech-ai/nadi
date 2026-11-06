"use client";

import { useActionState } from "react";
import Link from "next/link";
import { aturSandiBaru } from "@/app/auth-actions";
import type { Kamus } from "@/lib/i18n/kamus";
import { Tombol } from "@/components/ui/tombol";

export function FormSandiBaru({ teks: t }: { teks: Kamus["auth"] }) {
  const [hasil, kirim, menunggu] = useActionState(aturSandiBaru, {});
  return (
    <form action={kirim} className="grid gap-4" noValidate>
      <div>
        <label htmlFor="sandi" className="text-sm font-medium">{t.sandiBaru}</label>
        <input id="sandi" name="sandi" type="password" required minLength={8} autoComplete="new-password" autoFocus
          className="mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta" />
        <p className="mt-1 text-xs text-tinta-2">{t.minimal8}</p>
      </div>
      {hasil.galat ? (
        <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">
          {hasil.galat} <Link href="/masuk/lupa" className="font-semibold underline underline-offset-4">{t.lupaJudul}</Link>
        </p>
      ) : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? t.sebentar : t.simpanSandi}</Tombol>
    </form>
  );
}
