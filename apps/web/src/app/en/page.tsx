import type { Metadata } from "next";
import { Beranda } from "@/components/landing/beranda";
import { kamusEn } from "@/lib/i18n/kamus/en";

// Beranda bahasa Inggris (I-02): komponen yang sama dengan /, teks dari kamus en.
export const metadata: Metadata = {
  title: kamusEn.meta.judul,
  description: kamusEn.meta.deskripsi,
  alternates: { canonical: "/en", languages: { id: "/", en: "/en" } },
};

export default function HomeEn() {
  return <Beranda bahasa="en" />;
}
