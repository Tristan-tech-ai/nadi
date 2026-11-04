import type { Metadata } from "next";
import { BerandaPoster } from "@/components/poster/beranda-poster";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.poster.metaJudul,
  description: kamusId.poster.metaDeskripsi,
  alternates: { canonical: "/", languages: { id: "/", en: "/en" } },
};

export default function HalamanBeranda() {
  return <BerandaPoster bahasa="id" />;
}
