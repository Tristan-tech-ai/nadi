import type { Metadata } from "next";
import { HalamanPanduan } from "@/components/landing/halaman-panduan";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.panduanHalaman.metaJudul,
  description: kamusEn.panduanHalaman.metaDeskripsi,
  alternates: { canonical: "/en/panduan", languages: { id: "/panduan", en: "/en/panduan" } },
};

export default function PanduanEn() {
  return <HalamanPanduan bahasa="en" />;
}
