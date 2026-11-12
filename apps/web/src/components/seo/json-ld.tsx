import { jsonLdAman } from "@/lib/seo/json-ld";

/** Menaruh data terstruktur schema.org sebagai <script type="application/ld+json"> (pola docs Next, isi dinetralkan). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" data-testid="json-ld" dangerouslySetInnerHTML={{ __html: jsonLdAman(data) }} />;
}
