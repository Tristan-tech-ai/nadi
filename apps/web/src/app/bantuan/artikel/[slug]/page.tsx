import type { Metadata } from "next";
import { HalamanArtikel } from "@/components/bantuan/pusat";
import { artikel, SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";

export function generateStaticParams() {
  return SEMUA_ARTIKEL.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/bantuan/artikel/[slug]">): Promise<Metadata> {
  const a = artikel((await params).slug, "id");
  return a ? { title: `${a.judul} | Bantuan Nadi`, description: a.ringkas, alternates: { canonical: `/bantuan/artikel/${a.slug}`, languages: { id: `/bantuan/artikel/${a.slug}`, en: `/en/bantuan/artikel/${a.slug}` } } } : {};
}

export default async function ArtikelBantuan({ params }: PageProps<"/bantuan/artikel/[slug]">) {
  return <HalamanArtikel slug={(await params).slug} bahasa="id" />;
}
