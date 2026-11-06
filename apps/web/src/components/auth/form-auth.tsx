"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { HasilForm } from "@/lib/auth-pesan";
import type { Kamus } from "@/lib/i18n/kamus";
import { Tombol } from "@/components/ui/tombol";
import { FormKode } from "@/components/auth/form-kode";

type Aksi = (s: HasilForm, f: FormData) => Promise<HasilForm>;

const isianKelas =
  "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2";

export function FormAuth({ aksi, mode, next, teks: t }: { aksi: Aksi; mode: "masuk" | "daftar"; next?: string; teks: Kamus["auth"] }) {
  const [hasil, kirim, menunggu] = useActionState(aksi, {});
  // Daftar berhasil dan konfirmasi email menyala: langsung ke langkah kode (cadangan bila tautan email gagal).
  if (mode === "daftar" && hasil.info && hasil.isian?.email) return <FormKode jenis="daftar" email={hasil.isian.email} info={hasil.info} adaKode={!!hasil.kode} teks={t} />;
  const tautan = "font-semibold text-tinta underline underline-offset-4";
  return (
    <form action={kirim} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium">{t.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={hasil.isian?.email} className={isianKelas} placeholder={t.emailContoh} />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="sandi" className="text-sm font-medium">{t.sandi}</label>
          {mode === "masuk" ? <Link href="/masuk/lupa" className="text-sm text-tinta underline underline-offset-4">{t.lupaSandi}</Link> : null}
        </div>
        <input id="sandi" name="sandi" type="password" required minLength={mode === "daftar" ? 8 : undefined} autoComplete={mode === "daftar" ? "new-password" : "current-password"} className={isianKelas} />
        {mode === "daftar" ? <p className="mt-1 text-xs text-tinta-2">{t.minimal8}</p> : null}
      </div>
      {hasil.galat ? (
        <div role="alert" className="grid gap-2 rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">
          <p>{hasil.galat}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {mode === "daftar" ? <Link href="/masuk" className={tautan}>{t.masuk}</Link> : null}
            <Link href={`/masuk/kode${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={tautan}>{t.pakaiKode}</Link>
            <Link href="/masuk/lupa" className={tautan}>{t.lupaSandi}</Link>
          </p>
        </div>
      ) : null}
      {hasil.info ? (
        <p role="status" className="rounded-[var(--radius-isian)] border border-daun px-3 py-2 text-sm text-daun">{hasil.info}</p>
      ) : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>
        {menunggu ? t.sebentar : mode === "masuk" ? t.masuk : t.buatAkun}
      </Tombol>
      <p className="text-sm text-tinta-2">
        {mode === "masuk" ? (
          <><Link href={`/masuk/kode${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`${tautan} mb-3 block`} data-testid="tautan-kode">{t.pakaiKode}</Link>
          {t.belumPunya} <Link href="/daftar" className={tautan}>{t.daftarGratis}</Link></>
        ) : (
          <>{t.sudahPunya} <Link href="/masuk" className="font-semibold text-tinta underline underline-offset-4">{t.masuk}</Link></>
        )}
      </p>
    </form>
  );
}
