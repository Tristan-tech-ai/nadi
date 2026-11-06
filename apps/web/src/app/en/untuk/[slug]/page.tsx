import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HalamanUntuk } from "@/components/landing/halaman-untuk";
import { JENIS_USAHA } from "@/components/landing/untuk-usaha";

// L-02: satu halaman per jenis usaha, prerender statis.
export function generateStaticParams() {
  return JENIS_USAHA.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: PageProps<"/en/untuk/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const j = JENIS_USAHA.find((x) => x.slug === slug);
  if (!j) return {};
  return { title: j.judul.en, description: j.pendukung.en, alternates: { canonical: `/en/untuk/${slug}`, languages: { id: `/untuk/${slug}`, en: `/en/untuk/${slug}` } } };
}

export default async function Halaman({ params }: PageProps<"/en/untuk/[slug]">) {
  const { slug } = await params;
  if (!JENIS_USAHA.some((j) => j.slug === slug)) notFound();
  return <HalamanUntuk slug={slug} bahasa="en" />;
}
