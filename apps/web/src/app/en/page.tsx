import type { Metadata } from "next";
import { BerandaPoster } from "@/components/poster/beranda-poster";
import { kamusEn } from "@/lib/i18n/kamus/en";

// Beranda bahasa Inggris (I-02): komponen yang sama dengan /, teks dari kamus en.
export const metadata: Metadata = {
  title: kamusEn.poster.metaJudul,
  description: kamusEn.poster.metaDeskripsi,
  alternates: { canonical: "/en", languages: { id: "/", en: "/en" } },
};

export default function HomeEn() {
  return <BerandaPoster bahasa="en" />;
}
