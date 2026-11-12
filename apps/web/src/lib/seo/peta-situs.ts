import type { MetadataRoute } from "next";
import { JENIS_USAHA } from "@/components/landing/untuk-usaha";
import { SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";
import { kamusId } from "@/lib/i18n/kamus/id";
import { ISTILAH } from "@/lib/kamus-istilah";

/** Satu halaman publik yang boleh ditemukan mesin pencari. `en` diisi bila halaman yang sama punya versi bahasa Inggris. */
export type HalamanPublik = { id: string; en?: string };

const ALAT = ["dokumen", "gaji", "invoice", "pesangon", "slip", "thr"];
const DUA_BAHASA = ["/harga", "/untuk", "/integrasi", "/panduan", "/bantuan", "/alat", "/tentang", "/keamanan", "/privasi", "/syarat"];

/**
 * Daftar halaman publik Nadi, diambil dari sumber data yang sama dengan halaman itu (generateStaticParams), supaya
 * halaman baru otomatis ikut. Halaman aplikasi, masuk, cetak, dan tautan pribadi (struk, slip, tanda tangan) tidak ikut:
 * halaman itu sudah bertanda noindex atau butuh masuk.
 */
export function halamanPublik(): HalamanPublik[] {
  const dua = (jalur: string): HalamanPublik => ({ id: jalur, en: `/en${jalur}` });
  return [
    { id: "/", en: "/en" },
    ...DUA_BAHASA.map(dua),
    ...ALAT.map((a) => dua(`/alat/${a}`)),
    ...kamusId.fitur.map((f) => dua(`/fitur/${f.slug}`)),
    ...JENIS_USAHA.map((j) => dua(`/untuk/${j.slug}`)),
    ...SEMUA_ARTIKEL.map((a) => dua(`/bantuan/artikel/${a.slug}`)),
    { id: "/demo" },
    { id: "/kamus" },
    ...ISTILAH.map((i) => ({ id: `/kamus/${i.slug}` })),
  ];
}

/** Sitemap dengan URL absolut di domain utama dan pasangan bahasa (hreflang) per halaman. Tanpa lastmod karena Google hanya memakainya bila akurat. */
export function petaSitus(asal: string): MetadataRoute.Sitemap {
  const url = (jalur: string) => (jalur === "/" ? asal : `${asal}${jalur}`);
  return halamanPublik().flatMap((h) => {
    const bahasa = h.en ? { alternates: { languages: { id: url(h.id), en: url(h.en) } } } : {};
    return [{ url: url(h.id), ...bahasa }, ...(h.en ? [{ url: url(h.en), ...bahasa }] : [])];
  });
}

/** Area yang tidak berguna di hasil pencarian. Halaman bertanda noindex tetap boleh dirayapi supaya tanda itu terbaca. */
export const TERTUTUP = ["/app/", "/api/", "/cetak/", "/oauth/", "/dev/", "/auth/"];
