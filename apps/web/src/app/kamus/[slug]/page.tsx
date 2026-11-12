import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { JsonLd } from "@/components/seo/json-ld";
import { istilah, ISTILAH } from "@/lib/kamus-istilah";
import { dataIstilah } from "@/lib/seo/json-ld";
import { asalSitus } from "@/lib/situs";

export function generateStaticParams() {
  return ISTILAH.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/kamus/[slug]">): Promise<Metadata> {
  const i = istilah((await params).slug);
  return i ? { title: `Apa itu ${i.istilah}? | Kamus Nadi`, description: i.arti, alternates: { canonical: `/kamus/${i.slug}` } } : {};
}

export default async function HalamanIstilah({ params }: PageProps<"/kamus/[slug]">) {
  const i = istilah((await params).slug);
  if (!i) notFound();
  const lain = ISTILAH.filter((x) => x.slug !== i.slug && x.tautan.some((a) => i.tautan.some((b) => a.href === b.href))).slice(0, 6);
  return (
    <HalamanInfo judul={i.istilah} pengantar={i.arti} warna="kunyit">
      <JsonLd data={dataIstilah(asalSitus(), i)} />
      <nav aria-label="Jejak" className="text-[15px] text-tinta-2"><Link href="/kamus" className="underline underline-offset-4">Kamus istilah</Link> / {i.istilah}</nav>
      {i.dasar ? <p className="mt-6"><span className="font-semibold">Dasar aturan:</span> {i.dasar}</p> : null}
      <section className="mt-6" aria-labelledby="judul-dipakai">
        <h2 id="judul-dipakai" className="papan papan-sedang">Dipakai di Nadi</h2>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{i.tautan.map((a) => <Link key={a.href} href={a.href} className="font-semibold underline underline-offset-4" data-testid="tautan-istilah">{a.label}</Link>)}</p>
      </section>
      {lain.length ? (
        <section className="mt-8" aria-labelledby="judul-lain">
          <h2 id="judul-lain" className="papan papan-sedang">Istilah terkait</h2>
          <ul className="mt-3 grid gap-1">{lain.map((x) => <li key={x.slug}><Link href={`/kamus/${x.slug}`} className="underline underline-offset-4">{x.istilah}</Link></li>)}</ul>
        </section>
      ) : null}
    </HalamanInfo>
  );
}
