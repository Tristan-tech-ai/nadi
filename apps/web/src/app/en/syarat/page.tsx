import type { Metadata } from "next";
import { HalamanBagian } from "@/components/landing/halaman-bagian";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.syaratHalaman.metaJudul,
  description: kamusEn.syaratHalaman.metaDeskripsi,
  alternates: { canonical: "/en/syarat", languages: { id: "/syarat", en: "/en/syarat" } },
};

export default function SyaratEn() {
  return <HalamanBagian bahasa="en" isi={kamusEn.syaratHalaman} />;
}
