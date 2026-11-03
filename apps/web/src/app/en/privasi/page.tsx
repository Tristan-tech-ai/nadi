import type { Metadata } from "next";
import { HalamanBagian } from "@/components/landing/halaman-bagian";
import { kamusEn } from "@/lib/i18n/kamus/en";

export const metadata: Metadata = {
  title: kamusEn.privasiHalaman.metaJudul,
  description: kamusEn.privasiHalaman.metaDeskripsi,
  alternates: { canonical: "/en/privasi", languages: { id: "/privasi", en: "/en/privasi" } },
};

export default function PrivasiEn() {
  return <HalamanBagian bahasa="en" isi={kamusEn.privasiHalaman} />;
}
