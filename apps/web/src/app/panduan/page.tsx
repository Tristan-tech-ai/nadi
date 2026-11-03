import type { Metadata } from "next";
import { HalamanPanduan } from "@/components/landing/halaman-panduan";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.panduanHalaman.metaJudul,
  description: kamusId.panduanHalaman.metaDeskripsi,
  alternates: { canonical: "/panduan", languages: { id: "/panduan", en: "/en/panduan" } },
};

export default function Panduan() {
  return <HalamanPanduan bahasa="id" />;
}
