import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RUANG } from "@/lib/ruang";
import { ARTIKEL_HALAMAN, artikelUntuk, cariArtikel, kategori, kategoriUntuk, SEMUA_ARTIKEL, TUGAS } from "./artikel";
import { TUGAS_EN } from "./artikel-en";

const APP = join(__dirname, "..", "..", "app");
// Jalur publik atau /app yang benar-benar punya page.tsx (termasuk alat L-05).
const adaHalaman = (href: string) => existsSync(join(APP, ...href.split("?")[0].split("/").filter(Boolean), "page.tsx"));

describe("pusat bantuan", () => {
  it("setiap layar di peta ruang punya artikel", () => {
    const n = RUANG.reduce((a, r) => a + r.halaman.length, 0);
    expect(ARTIKEL_HALAMAN.length).toBe(n);
    expect(n).toBeGreaterThanOrEqual(50);
  });
  it("slug unik dan setiap artikel punya kategori yang tampil", () => {
    const slug = SEMUA_ARTIKEL.map((a) => a.slug);
    expect(new Set(slug).size).toBe(slug.length);
    const kat = new Set(kategori().map((k) => k.id));
    for (const a of SEMUA_ARTIKEL) expect(kat.has(a.kategori), a.slug).toBe(true);
  });
  it("artikel tugas cukup banyak, berlangkah, dan setiap tautannya ada", () => {
    expect(TUGAS.length).toBeGreaterThanOrEqual(10);
    for (const t of TUGAS) {
      expect(t.langkah.length, t.slug).toBeGreaterThanOrEqual(3);
      for (const l of t.tautan) expect(adaHalaman(l.href), `${t.slug} -> ${l.href}`).toBe(true);
    }
  });
  it("teks tanpa tanda pisah panjang dan kata terlarang", () => {
    const semua = JSON.stringify(TUGAS);
    expect(semua).not.toMatch(/[\u2013\u2014]/);
    expect(semua.toLowerCase()).not.toMatch(/silakan|revolusioner|inovatif|seamless/);
  });
  it("cari: kata sehari-hari menemukan artikel yang tepat", () => {
    expect(cariArtikel("lupa kata sandi")[0]?.slug).toBe("tidak-bisa-masuk");
    expect(cariArtikel("payroll").some((a) => a.slug === "gaji")).toBe(true);
    expect(cariArtikel("chatgpt")[0]?.slug).toBe("sambung-ai");
    expect(cariArtikel("qris").some((a) => a.slug === "invoice-qris")).toBe(true);
    expect(cariArtikel("zzzqqq")).toEqual([]);
    expect(cariArtikel("  ")).toEqual([]);
  });
  it("versi Inggris: setiap artikel tugas diterjemahkan lengkap, kategori dan cari jalan", () => {
    for (const t of TUGAS) {
      const e = TUGAS_EN[t.slug];
      expect(e, t.slug).toBeTruthy();
      expect(e.langkah.length, t.slug).toBe(t.langkah.length);
      expect(e.tautan.length, t.slug).toBe(t.tautan.length);
      expect(Boolean(e.catatan), t.slug).toBe(Boolean(t.catatan));
    }
    expect(JSON.stringify(TUGAS_EN)).not.toMatch(/[\u2013\u2014]/);
    const en = artikelUntuk("en");
    expect(en.length).toBe(SEMUA_ARTIKEL.length);
    const kat = new Set(kategoriUntuk("en").map((k) => k.id));
    for (const a of en) expect(kat.has(a.kategori), a.slug).toBe(true);
    expect(cariArtikel("forgot password", "en")[0]?.slug).toBe("tidak-bisa-masuk");
    expect(cariArtikel("payroll", "en").some((a) => a.slug === "gaji")).toBe(true);
  });
});
