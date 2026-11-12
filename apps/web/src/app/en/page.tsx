import type { Metadata } from "next";
import { BerandaPoster } from "@/components/poster/beranda-poster";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { JsonLd } from "@/components/seo/json-ld";
import { dataBeranda } from "@/lib/seo/json-ld";
import { asalSitus } from "@/lib/situs";

// Beranda bahasa Inggris (I-02): komponen yang sama dengan /, teks dari kamus en.
export const metadata: Metadata = {
  title: kamusEn.poster.metaJudul,
  description: kamusEn.poster.metaDeskripsi,
  alternates: { canonical: "/en", languages: { id: "/", en: "/en" } },
};

export default function HomeEn() {
  return <><JsonLd data={dataBeranda(asalSitus(), "en")} /><BerandaPoster bahasa="en" /></>;
}
