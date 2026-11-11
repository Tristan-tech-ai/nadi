import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RUANG } from "@/lib/ruang";
import { KATALOG_RESMI } from "@/lib/mod/katalog";
import { ARTIKEL_HALAMAN, ARTIKEL_PAKET, artikelUntuk, cariArtikel, kategori, kategoriUntuk, SEMUA_ARTIKEL, TUGAS } from "./artikel";
import { TUGAS_EN } from "./artikel-en";

const APP = join(__dirname, "..", "..", "app");
// Jalur publik atau /app yang benar-benar punya page.tsx (termasuk alat L-05).
const adaHalaman = (href: string) => existsSync(join(APP, ...href.split("?")[0].split("/").filter(Boolean), "page.tsx"));
// Halaman rincian paket resmi memakai segmen dinamis [kode] dan hanya menerima kode di katalog.
const adaRincianPaket = (href: string) => /^\/app\/tambah-fitur\/[a-z0-9-]+$/.test(href) && existsSync(join(APP, "app", "tambah-fitur", "[kode]", "page.tsx"))
  && KATALOG_RESMI.some((p) => href.endsWith(`/${p.manifest.kode}`));

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
  it("X-14: setiap paket resmi punya artikel berlangkah dengan tautan yang ada, dalam dua bahasa", () => {
    expect(ARTIKEL_PAKET.map((a) => a.slug)).toEqual(KATALOG_RESMI.map((p) => `paket-${p.manifest.kode}`));
    for (const a of ARTIKEL_PAKET) {
      expect(a.kategori).toBe("tambahan");
      expect(a.langkah.length, a.slug).toBeGreaterThanOrEqual(3);
      for (const l of a.tautan) expect(adaHalaman(l.href) || adaRincianPaket(l.href), `${a.slug} -> ${l.href}`).toBe(true);
      const en = artikelUntuk("en").find((x) => x.slug === a.slug)!;
      expect(en.jenis === "tugas" && en.langkah.length).toBe(a.langkah.length);
      expect(en.judul).not.toBe(a.judul);
    }
    expect(JSON.stringify(ARTIKEL_PAKET)).not.toMatch(/[–—]/);
    expect(cariArtikel("kendaraan")[0]?.slug).toBe("paket-armada");
    expect(cariArtikel("tiket helpdesk")[0]?.slug).toBe("paket-helpdesk-internal");
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
