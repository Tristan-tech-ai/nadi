import type { Metadata } from "next";
import { daftar } from "@/app/auth-actions";
import { FormAuth } from "@/components/auth/form-auth";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";

export const metadata: Metadata = { title: "Daftar ke Nadi" };

export default function Daftar() {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.daftarJudul, sub: t.daftarSub, badan: <FormAuth aksi={daftar} mode="daftar" teks={t} /> })} />
  );
}
