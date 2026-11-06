import type { Metadata } from "next";
import { HalamanArtikel } from "@/components/bantuan/pusat";
import { artikel, SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";

export function generateStaticParams() {
  return SEMUA_ARTIKEL.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/en/bantuan/artikel/[slug]">): Promise<Metadata> {
  const a = artikel((await params).slug, "en");
  return a ? { title: `${a.judul} | Nadi help`, description: a.ringkas, alternates: { canonical: `/en/bantuan/artikel/${a.slug}`, languages: { id: `/bantuan/artikel/${a.slug}`, en: `/en/bantuan/artikel/${a.slug}` } } } : {};
}

export default async function ArtikelBantuan({ params }: PageProps<"/en/bantuan/artikel/[slug]">) {
  return <HalamanArtikel slug={(await params).slug} bahasa="en" />;
}
