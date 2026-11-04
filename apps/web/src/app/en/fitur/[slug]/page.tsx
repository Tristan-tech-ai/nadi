import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HalamanFitur } from "@/components/poster/halaman-fitur";
import { kamusEn } from "@/lib/i18n/kamus/en";

// Feature pages in English (D-25): same component, English dictionary.
export function generateStaticParams() {
  return kamusEn.fitur.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/en/fitur/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const f = kamusEn.fitur.find((x) => x.slug === slug);
  if (!f) return {};
  return { title: `${f.nama}: ${f.judul}`, description: f.pendukung, alternates: { canonical: `/en/fitur/${slug}`, languages: { id: `/fitur/${slug}`, en: `/en/fitur/${slug}` } } };
}

export default async function Page({ params }: PageProps<"/en/fitur/[slug]">) {
  const { slug } = await params;
  if (!kamusEn.fitur.some((f) => f.slug === slug)) notFound();
  return <HalamanFitur slug={slug} bahasa="en" />;
}
