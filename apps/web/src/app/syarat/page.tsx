import type { Metadata } from "next";
import { HalamanBagian } from "@/components/landing/halaman-bagian";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.syaratHalaman.metaJudul,
  description: kamusId.syaratHalaman.metaDeskripsi,
  alternates: { canonical: "/syarat", languages: { id: "/syarat", en: "/en/syarat" } },
};

export default function Syarat() {
  return <HalamanBagian bahasa="id" isi={kamusId.syaratHalaman} />;
}
