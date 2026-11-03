import type { Metadata } from "next";
import { HalamanTentang } from "@/components/landing/halaman-tentang";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.tentangHalaman.metaJudul,
  description: kamusEn.tentangHalaman.metaDeskripsi,
  alternates: { canonical: "/en/tentang", languages: { id: "/tentang", en: "/en/tentang" } },
};

export default function TentangEn() {
  return <HalamanTentang bahasa="en" />;
}
