import type { Metadata } from "next";
import Link from "next/link";
import { FormKode } from "@/components/auth/form-kode";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";

export const metadata: Metadata = { title: "Atur ulang kata sandi", robots: { index: false } };

// Lupa kata sandi: kode atur ulang dari email (atau tautannya), lalu halaman kata sandi baru.
export default function LupaSandi() {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.lupaJudul, sub: t.lupaSub, badan: (<>
      <FormKode jenis="lupa" teks={t} />
      <p className="mt-6 text-sm"><Link href="/masuk" className="text-tinta underline underline-offset-4">{t.kembaliMasuk}</Link></p>
    </>) })} />
  );
}
