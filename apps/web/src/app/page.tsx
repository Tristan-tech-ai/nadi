import type { Metadata } from "next";
import { BerandaPoster } from "@/components/poster/beranda-poster";
import { kamusId } from "@/lib/i18n/kamus/id";
import { JsonLd } from "@/components/seo/json-ld";
import { dataBeranda } from "@/lib/seo/json-ld";
import { asalSitus } from "@/lib/situs";

export const metadata: Metadata = {
  title: kamusId.poster.metaJudul,
  description: kamusId.poster.metaDeskripsi,
  alternates: { canonical: "/", languages: { id: "/", en: "/en" } },
};

export default function HalamanBeranda() {
  return <><JsonLd data={dataBeranda(asalSitus(), "id")} /><BerandaPoster bahasa="id" /></>;
}
