import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { angkaRupiah, bacaStruk, cocokKategori } from "./struk";

const AKAR = join(__dirname, "../../../../../fixtures/korpus/struk");
const harapan = JSON.parse(readFileSync(join(AKAR, "harapan.json"), "utf8")) as Record<string, { total: number; tanggal: string; kategori: string }>;

describe("pengurai struk (M-18)", () => {
  it("korpus 32 struk: total, tanggal, dan kategori masing-masing >= 90% benar", () => {
    const berkas = readdirSync(AKAR).filter((f) => f.endsWith(".txt"));
    expect(berkas.length).toBe(32);
    let total = 0, tanggal = 0, kategori = 0;
    const salah: string[] = [];
    for (const f of berkas) {
      const h = bacaStruk(readFileSync(join(AKAR, f), "utf8"));
      const e = harapan[f];
      if (h.total === e.total) total++; else salah.push(`${f} total ${h.total} != ${e.total}`);
      if (h.tanggal === e.tanggal) tanggal++; else salah.push(`${f} tanggal ${h.tanggal} != ${e.tanggal}`);
      if (h.kategori === e.kategori) kategori++; else salah.push(`${f} kategori ${h.kategori} != ${e.kategori}`);
    }
    console.log(`struk: total ${total}/32, tanggal ${tanggal}/32, kategori ${kategori}/32`, salah);
    expect(total / 32).toBeGreaterThanOrEqual(0.9);
    expect(tanggal / 32).toBeGreaterThanOrEqual(0.9);
    expect(kategori / 32).toBeGreaterThanOrEqual(0.9);
  });
  it("format rupiah umum", () => {
    expect(angkaRupiah("Rp 45.000")).toBe(45000);
    expect(angkaRupiah("IDR 1,350,000.00")).toBe(1350000);
    expect(angkaRupiah("Rp45.500,00")).toBe(45500);
    expect(angkaRupiah("tanpa angka")).toBeNull();
  });
  it("tanggal tidak sah tidak ditebak", () => {
    expect(bacaStruk("Tanggal 31/02/2026\nTotal Rp10.000").tanggal).toBeNull();
  });
  it("tebakan dipetakan ke kategori usaha", () => {
    const k = [{ id: "a", nama: "Bensin dan BBM" }, { id: "b", nama: "Parkir" }];
    expect(cocokKategori("bensin", k)).toBe("a");
    expect(cocokKategori("hotel", k)).toBeNull();
  });
});
