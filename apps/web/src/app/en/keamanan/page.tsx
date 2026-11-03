import type { Metadata } from "next";
import { HalamanKeamanan } from "@/components/landing/halaman-keamanan";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.keamananHalaman.metaJudul,
  description: kamusEn.keamananHalaman.metaDeskripsi,
  alternates: { canonical: "/en/keamanan", languages: { id: "/keamanan", en: "/en/keamanan" } },
};

export default function SecurityEn() {
  return <HalamanKeamanan bahasa="en" />;
}
