import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HalamanFitur } from "@/components/poster/halaman-fitur";
import { kamusId } from "@/lib/i18n/kamus/id";

// Halaman fitur D-25 (docs/design/DESIGN.md): satu halaman per pekerjaan, prerender statis.
export function generateStaticParams() {
  return kamusId.fitur.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/fitur/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const f = kamusId.fitur.find((x) => x.slug === slug);
  if (!f) return {};
  return { title: `${f.nama}: ${f.judul}`, description: f.pendukung, alternates: { canonical: `/fitur/${slug}`, languages: { id: `/fitur/${slug}`, en: `/en/fitur/${slug}` } } };
}

export default async function Halaman({ params }: PageProps<"/fitur/[slug]">) {
  const { slug } = await params;
  if (!kamusId.fitur.some((f) => f.slug === slug)) notFound();
  return <HalamanFitur slug={slug} bahasa="id" />;
}
