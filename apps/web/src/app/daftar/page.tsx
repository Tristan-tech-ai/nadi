import type { Metadata } from "next";
import { daftar } from "@/app/auth-actions";
import { FormAuth } from "@/components/auth/form-auth";
import { Suspense } from "react";
import { MasukGoogle } from "@/components/auth/masuk-google";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";

export const metadata: Metadata = { title: "Daftar ke Nadi" };

export default function Daftar() {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.daftarJudul, sub: t.daftarSub, badan: (<>
      <FormAuth aksi={daftar} mode="daftar" teks={t} />
      <Suspense fallback={<div className="mt-6 h-20" aria-hidden />}><MasukGoogle next="/app/mulai" mode="daftar" teks={t} /></Suspense>
    </>) })} />
  );
}
