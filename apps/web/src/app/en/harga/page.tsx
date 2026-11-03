import type { Metadata } from "next";
import { HalamanHarga } from "@/components/landing/halaman-harga";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.harga.metaJudul,
  description: kamusEn.harga.metaDeskripsi,
  alternates: { canonical: "/en/harga", languages: { id: "/harga", en: "/en/harga" } },
};

export default function PricingEn() {
  return <HalamanHarga bahasa="en" />;
}
