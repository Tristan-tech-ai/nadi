"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KUKI_BAHASA, tujuanPemilih, UMUR_KUKI_BAHASA, type Bahasa } from "@/lib/i18n/bahasa";

/** Tautan ke bahasa lain di halaman publik. Pilihan disimpan di cookie agar kunjungan ke / berikutnya langsung ke bahasanya. */
export function PemilihBahasa({ bahasa }: { bahasa: Bahasa }) {
  const jalur = usePathname() || "/";
  const tujuan: Bahasa = bahasa === "id" ? "en" : "id";
  const ingat = () => {
    document.cookie = `${KUKI_BAHASA}=${tujuan}; Path=/; Max-Age=${UMUR_KUKI_BAHASA}; SameSite=Lax`;
  };
  return (
    <Link
      href={tujuanPemilih(jalur, tujuan)}
      onClick={ingat}
      prefetch={false}
      hrefLang={tujuan}
      lang={tujuan}
      data-testid="pemilih-bahasa"
      className="underline-offset-4 hover:underline"
    >
      {tujuan === "en" ? "English" : "Bahasa Indonesia"}
    </Link>
  );
}
