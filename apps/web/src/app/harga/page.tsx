import type { Metadata } from "next";
import { HalamanHarga } from "@/components/landing/halaman-harga";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.harga.metaJudul,
  description: kamusId.harga.metaDeskripsi,
  alternates: { canonical: "/harga", languages: { id: "/harga", en: "/en/harga" } },
};

export default function Harga() {
  return <HalamanHarga bahasa="id" />;
}
