import type { Metadata } from "next";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { FormSandiBaru } from "./form-sandi-baru";

export const metadata: Metadata = { title: "Kata sandi baru", robots: { index: false } };

// Setelah kode atau tautan atur ulang: sesi recovery sudah ada, tinggal menyimpan kata sandi baru.
export default function SandiBaru() {
  return <KerangkaAuth isi={(t) => ({ judul: t.sandiBaruJudul, sub: t.sandiBaruSub, badan: <FormSandiBaru teks={t} /> })} />;
}
