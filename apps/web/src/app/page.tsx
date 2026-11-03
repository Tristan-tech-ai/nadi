import type { Metadata } from "next";
import { Beranda } from "@/components/landing/beranda";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.meta.judul,
  description: kamusId.meta.deskripsi,
  alternates: { canonical: "/", languages: { id: "/", en: "/en" } },
};

export default function HalamanBeranda() {
  return <Beranda bahasa="id" />;
}
