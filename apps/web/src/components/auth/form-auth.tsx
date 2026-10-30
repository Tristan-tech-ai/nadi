"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { HasilForm } from "@/lib/auth-pesan";
import { Tombol } from "@/components/ui/tombol";

type Aksi = (s: HasilForm, f: FormData) => Promise<HasilForm>;

const isianKelas =
  "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2";

export function FormAuth({ aksi, mode, next }: { aksi: Aksi; mode: "masuk" | "daftar"; next?: string }) {
  const [hasil, kirim, menunggu] = useActionState(aksi, {});
  return (
    <form action={kirim} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={hasil.isian?.email} className={isianKelas} placeholder="made@warungku.id" />
      </div>
      <div>
        <label htmlFor="sandi" className="text-sm font-medium">Kata sandi</label>
        <input id="sandi" name="sandi" type="password" required minLength={mode === "daftar" ? 8 : undefined} autoComplete={mode === "daftar" ? "new-password" : "current-password"} className={isianKelas} />
        {mode === "daftar" ? <p className="mt-1 text-xs text-tinta-2">Minimal 8 karakter.</p> : null}
      </div>
      {hasil.galat ? (
        <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p>
      ) : null}
      {hasil.info ? (
        <p role="status" className="rounded-[var(--radius-isian)] border border-daun px-3 py-2 text-sm text-daun">{hasil.info}</p>
      ) : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>
        {menunggu ? "Sebentar..." : mode === "masuk" ? "Masuk" : "Buat akun"}
      </Tombol>
      <p className="text-sm text-tinta-2">
        {mode === "masuk" ? (
          <>Belum punya akun? <Link href="/daftar" className="font-semibold text-tinta underline underline-offset-4">Daftar gratis</Link></>
        ) : (
          <>Sudah punya akun? <Link href="/masuk" className="font-semibold text-tinta underline underline-offset-4">Masuk</Link></>
        )}
      </p>
    </form>
  );
}
