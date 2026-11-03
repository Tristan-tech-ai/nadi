import type { Metadata } from "next";
import { HalamanKeamanan } from "@/components/landing/halaman-keamanan";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.keamananHalaman.metaJudul,
  description: kamusId.keamananHalaman.metaDeskripsi,
  alternates: { canonical: "/keamanan", languages: { id: "/keamanan", en: "/en/keamanan" } },
};

export default function Keamanan() {
  return <HalamanKeamanan bahasa="id" />;
}
