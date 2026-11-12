/**
 * Data terstruktur schema.org untuk mesin pencari (docs Next "JSON-LD"; Google Search Central Organization, dibaca 12 Nov 2026).
 * Hanya fakta yang benar: tanpa rating, ulasan, atau angka pengguna karangan (ANTI-SLOP S34), jadi SoftwareApplication tidak
 * mengejar rich result yang mewajibkan rating; ia tetap menjelaskan apa itu Nadi.
 */
export type Bahasa = "id" | "en";

/** JSON.stringify yang aman ditaruh di <script>: "<" diganti < supaya isi tidak bisa menutup tag (saran docs Next). */
export function jsonLdAman(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const TEKS = {
  id: {
    alternatif: "Nadi Usaha",
    deskripsi: "Lempar berkas usaha apa saja (foto nota, Excel, mutasi bank, surat) dan Nadi merapikannya menjadi usulan yang tinggal disetujui pemilik dari HP. Format berkas yang sama dibaca berikutnya tanpa AI supaya hemat, dan fitur bisa ditambah sesuai usahamu.",
    kategori: "Pembukuan dan operasional otomatis dari berkas untuk usaha kecil",
  },
  en: {
    alternatif: "Nadi Usaha",
    deskripsi: "Drop in any business file (receipt photo, spreadsheet, bank statement, letter) and Nadi sorts it into proposals the owner approves from a phone. The same file layout is read without AI next time to save cost, and features can be added to fit your business.",
    kategori: "Automatic bookkeeping and operations from files for small businesses",
  },
} as const;

/** Organization + WebSite + SoftwareApplication untuk beranda (Google: Organization cukup di beranda). */
export function dataBeranda(asal: string, bahasa: Bahasa) {
  const t = TEKS[bahasa];
  const org = `${asal}/#organisasi`;
  const beranda = bahasa === "id" ? asal : `${asal}/en`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: "Nadi", alternateName: t.alternatif, url: asal, logo: `${asal}/ikon/ikon-512.png` },
      { "@type": "WebSite", "@id": `${asal}/#situs`, name: "Nadi", alternateName: t.alternatif, url: beranda, inLanguage: bahasa, publisher: { "@id": org } },
      {
        "@type": "SoftwareApplication", name: "Nadi", url: beranda, description: t.deskripsi, applicationCategory: "BusinessApplication",
        applicationSubCategory: t.kategori, operatingSystem: "Web", inLanguage: ["id", "en"], publisher: { "@id": org },
        offers: { "@type": "Offer", price: 0, priceCurrency: "IDR" },
      },
    ],
  };
}

/** Istilah kamus sebagai DefinedTerm di dalam DefinedTermSet Kamus Nadi. */
export function dataIstilah(asal: string, i: { slug: string; istilah: string; arti: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm", name: i.istilah, description: i.arti, url: `${asal}/kamus/${i.slug}`, inLanguage: "id",
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Kamus istilah usaha Nadi", url: `${asal}/kamus` },
  };
}

/** Artikel bantuan sebagai TechArticle dengan jejak remah (BreadcrumbList) ke pusat bantuan. */
export function dataArtikel(asal: string, bahasa: Bahasa, a: { slug: string; judul: string; ringkas: string }) {
  const awal = bahasa === "id" ? "" : "/en";
  const url = `${asal}${awal}/bantuan/artikel/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "TechArticle", headline: a.judul, description: a.ringkas, url, inLanguage: bahasa, publisher: { "@type": "Organization", name: "Nadi", url: asal } },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nadi", item: bahasa === "id" ? asal : `${asal}/en` },
          { "@type": "ListItem", position: 2, name: bahasa === "id" ? "Bantuan" : "Help", item: `${asal}${awal}/bantuan` },
          { "@type": "ListItem", position: 3, name: a.judul, item: url },
        ],
      },
    ],
  };
}
