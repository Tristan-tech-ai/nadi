import { describe, expect, it } from "vitest";
import { jadwalSusut, nilaiBuku } from "./susut";

// Contoh dihitung tangan dari Pasal 11 UU PPh (UU 7/2021); angka sama dengan tes SQL aset_tetap.
describe("penyusutan fiskal (M-06)", () => {
  it("saldo menurun Kelompok 1 Rp12.000.000 mulai Jan 2026: 500.000, 250.000, 125.000, lalu sisa sekaligus", () => {
    const j = jadwalSusut(12_000_000, "k1", "saldo_menurun", "2026-01");
    expect(j).toHaveLength(48);
    expect(j[0]).toEqual({ bulan: "2026-01", nilai: 500_000 });
    expect(j[12]).toEqual({ bulan: "2027-01", nilai: 250_000 });
    expect(j[24]).toEqual({ bulan: "2028-01", nilai: 125_000 });
    expect(j[36]).toEqual({ bulan: "2029-01", nilai: 62_500 });
    expect(j[47]).toEqual({ bulan: "2029-12", nilai: 812_500 });
    expect(j.reduce((s, x) => s + x.nilai, 0)).toBe(12_000_000);
  });
  it("saldo menurun mulai pertengahan tahun: tahun pertama 50% x harga / 12 per bulan, tahun berikut dari nilai buku awal tahun", () => {
    const j = jadwalSusut(12_000_000, "k1", "saldo_menurun", "2026-07");
    expect(j.filter((x) => x.bulan.startsWith("2026")).reduce((s, x) => s + x.nilai, 0)).toBe(3_000_000);
    expect(j.find((x) => x.bulan === "2027-01")!.nilai).toBe(375_000);
    expect(j.reduce((s, x) => s + x.nilai, 0)).toBe(12_000_000);
  });
  it("garis lurus Kelompok 2 Rp10.000.000 selama 96 bulan, jumlah tepat", () => {
    const j = jadwalSusut(10_000_000, "k2", "garis_lurus", "2026-03");
    expect(j).toHaveLength(96);
    expect(new Set(j.map((x) => x.nilai))).toEqual(new Set([104_166, 104_167]));
    expect(j.reduce((s, x) => s + x.nilai, 0)).toBe(10_000_000);
    expect(nilaiBuku(10_000_000, "k2", "garis_lurus", "2026-03", "2026-12")).toBe(10_000_000 - Math.round((10_000_000 * 10) / 96));
  });
  it("bangunan permanen 20 tahun garis lurus; saldo menurun ditolak; tanah tidak disusutkan", () => {
    expect(jadwalSusut(240_000_000, "bangunan_permanen", "garis_lurus", "2026-01")[0].nilai).toBe(1_000_000);
    expect(() => jadwalSusut(240_000_000, "bangunan_permanen", "saldo_menurun", "2026-01")).toThrow(/ayat \(2\)/);
    expect(jadwalSusut(500_000_000, "tanah", "garis_lurus", "2026-01")).toEqual([]);
  });
});
