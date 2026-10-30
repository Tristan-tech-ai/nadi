import type { Metadata } from "next";
import { daftar } from "@/app/auth-actions";
import { FormAuth } from "@/components/auth/form-auth";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";

export const metadata: Metadata = { title: "Daftar ke Nadi" };

export default function Daftar() {
  return (
    <KerangkaAuth judul="Buat akun" sub="Gratis untuk mulai. Setelah ini kamu memberi nama usahamu, lalu langsung bisa melempar berkas pertama.">
      <FormAuth aksi={daftar} mode="daftar" />
    </KerangkaAuth>
  );
}
