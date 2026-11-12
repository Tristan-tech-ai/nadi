import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JENIS_USAHA } from "@/components/landing/untuk-usaha";
import { SEMUA_ARTIKEL } from "@/lib/bantuan/artikel";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { kamusId } from "@/lib/i18n/kamus/id";
import { ISTILAH } from "@/lib/kamus-istilah";
import { dataArtikel, dataBeranda, dataIstilah, jsonLdAman } from "./json-ld";
import { halamanPublik, petaSitus, TERTUTUP } from "./peta-situs";

const ASAL = "https://nadiusaha.my.id";
const APP = join(__dirname, "..", "..", "app");
// Jalur publik -> berkas page.tsx; segmen dinamis dicocokkan dengan folder [slug].
function adaHalaman(jalur: string): boolean {
  const bagian = jalur.split("/").filter(Boolean);
  const coba = (i: number, dir: string): boolean => {
    if (i === bagian.length) return existsSync(join(dir, "page.tsx"));
    return (existsSync(join(dir, bagian[i])) && coba(i + 1, join(dir, bagian[i]))) || (existsSync(join(dir, "[slug]")) && coba(i + 1, join(dir, "[slug]")));
  };
  return coba(0, APP);
}

describe("sitemap", () => {
  const peta = petaSitus(ASAL);
  const url = peta.map((p) => p.url);

  it("memuat setiap fitur, jenis usaha, artikel bantuan, dan istilah kamus", () => {
    for (const f of kamusId.fitur) expect(url).toContain(`${ASAL}/fitur/${f.slug}`);
    for (const j of JENIS_USAHA) expect(url).toContain(`${ASAL}/en/untuk/${j.slug}`);
    for (const a of SEMUA_ARTIKEL) expect(url).toContain(`${ASAL}/bantuan/artikel/${a.slug}`);
    for (const i of ISTILAH) expect(url).toContain(`${ASAL}/kamus/${i.slug}`);
    expect(url).toContain(ASAL);
    expect(url).toContain(`${ASAL}/en`);
  });

  it("hanya URL absolut di domain utama, tanpa duplikat dan tanpa area tertutup", () => {
    expect(new Set(url).size).toBe(url.length);
    for (const u of url) {
      expect(u.startsWith(ASAL)).toBe(true);
      expect(u).not.toContain("vercel.app");
      for (const t of TERTUTUP) expect(u.slice(ASAL.length) + "/").not.toContain(t);
    }
  });

  it("setiap jalur di sitemap punya halaman di app/", () => {
    for (const h of halamanPublik()) {
      expect(adaHalaman(h.id), h.id).toBe(true);
      if (h.en) expect(adaHalaman(h.en), h.en).toBe(true);
    }
  });

  it("fitur bahasa Inggris memakai slug yang sama, dan pasangan bahasa saling menunjuk", () => {
    expect(kamusEn.fitur.map((f) => f.slug)).toEqual(kamusId.fitur.map((f) => f.slug));
    const harga = peta.filter((p) => p.url.endsWith("/harga"));
    expect(harga).toHaveLength(2);
    for (const p of harga) expect(p.alternates?.languages).toEqual({ id: `${ASAL}/harga`, en: `${ASAL}/en/harga` });
  });
});

describe("data terstruktur", () => {
  it("isi tidak bisa menutup tag script", () => {
    const keluar = jsonLdAman({ a: "</script><script>alert(1)</script>" });
    expect(keluar).not.toContain("<");
    expect(JSON.parse(keluar).a).toBe("</script><script>alert(1)</script>");
  });

  it("beranda: Organization, WebSite, SoftwareApplication tanpa rating karangan", () => {
    for (const b of ["id", "en"] as const) {
      const d = dataBeranda(ASAL, b);
      expect(d["@graph"].map((x) => x["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
      const teks = JSON.stringify(d);
      expect(teks).not.toMatch(/aggregateRating|review|ratingValue/);
      expect(teks).not.toContain("vercel.app");
    }
    // Pesan inti dulu (lempar berkas apa saja), bukan daftar fitur umum.
    expect(dataBeranda(ASAL, "id")["@graph"][2]).toMatchObject({ description: expect.stringMatching(/^Lempar berkas usaha apa saja/) });
  });

  it("istilah dan artikel memakai URL kanonis halaman itu", () => {
    const i = ISTILAH[0];
    expect(dataIstilah(ASAL, i).url).toBe(`${ASAL}/kamus/${i.slug}`);
    const a = SEMUA_ARTIKEL[0];
    const d = dataArtikel(ASAL, "en", a);
    expect(d["@graph"][0].url).toBe(`${ASAL}/en/bantuan/artikel/${a.slug}`);
    expect((d["@graph"][1] as { itemListElement: { item: string }[] }).itemListElement.at(-1)?.item).toBe(`${ASAL}/en/bantuan/artikel/${a.slug}`);
  });

  it("judul beranda di hasil pencarian mendahulukan pesan inti dan muat 60 karakter", () => {
    for (const k of [kamusId, kamusEn]) {
      expect(k.poster.metaJudul.length).toBeLessThanOrEqual(60);
      expect(k.poster.metaDeskripsi.length).toBeLessThanOrEqual(165);
    }
    expect(kamusId.poster.metaJudul).toMatch(/lempar/i);
  });
});
