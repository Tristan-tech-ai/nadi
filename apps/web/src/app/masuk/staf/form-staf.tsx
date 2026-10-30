"use client";

import { useActionState } from "react";
import Link from "next/link";
import { masukStaf } from "@/app/auth-actions";
import { Tombol } from "@/components/ui/tombol";

const kelas = "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base uppercase tracking-wider text-tinta placeholder:normal-case placeholder:tracking-normal placeholder:text-tinta-2";

export function FormStaf() {
  const [hasil, kirim, menunggu] = useActionState(masukStaf, {});
  return (
    <form action={kirim} className="grid gap-4" noValidate>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div>
          <label htmlFor="kode" className="text-sm font-medium">Kode usaha</label>
          <input id="kode" name="kode" required autoComplete="organization" maxLength={6} defaultValue={hasil.isian?.kode} placeholder="6 huruf" className={`${kelas} font-mono`} />
        </div>
        <div>
          <label htmlFor="id" className="text-sm font-medium">ID kamu</label>
          <input id="id" name="id" required autoComplete="username" maxLength={6} defaultValue={hasil.isian?.id} placeholder="S001" className={`${kelas} font-mono`} />
        </div>
      </div>
      <div>
        <label htmlFor="pin" className="text-sm font-medium">PIN</label>
        <input id="pin" name="pin" required type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="current-password" className={kelas} />
      </div>
      {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
      <Tombol type="submit" ukuran="besar" disabled={menunggu}>{menunggu ? "Sebentar..." : "Masuk"}</Tombol>
      <p className="text-sm text-tinta-2">
        Pemilik atau admin? <Link href="/masuk" className="font-semibold text-tinta underline underline-offset-4">Masuk dengan email</Link>
      </p>
    </form>
  );
}
