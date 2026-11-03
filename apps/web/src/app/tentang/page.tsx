import type { Metadata } from "next";
import { HalamanTentang } from "@/components/landing/halaman-tentang";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.tentangHalaman.metaJudul,
  description: kamusId.tentangHalaman.metaDeskripsi,
  alternates: { canonical: "/tentang", languages: { id: "/tentang", en: "/en/tentang" } },
};

export default function Tentang() {
  return <HalamanTentang bahasa="id" />;
}
