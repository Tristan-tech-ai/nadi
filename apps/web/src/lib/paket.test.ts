import { describe, expect, it } from "vitest";
import { PAKET, hargaBulanan } from "./paket";

describe("paket", () => {
  it("urut naik harga dan batas orang", () => {
    for (let i = 1; i < PAKET.length; i++) {
      expect(PAKET[i].harga).toBeGreaterThan(PAKET[i - 1].harga);
      expect(PAKET[i].orang).toBeGreaterThan(PAKET[i - 1].orang);
    }
  });
  it("sama dengan docs/bisnis/paket.md", () => {
    expect(PAKET.map((p) => [p.kode, p.harga, p.orang, p.perOrangTambahan])).toEqual([
      ["gratis", 0, 5, null], ["usaha", 149000, 15, 5000], ["tumbuh", 349000, 50, 5000], ["perusahaan", 1500000, 150, 4000],
    ]);
  });
  it("harga untuk jumlah orang", () => {
    const [gratis, usaha] = PAKET;
    expect(hargaBulanan(gratis, 5)).toBe(0);
    expect(hargaBulanan(gratis, 6)).toBeNull();
    expect(hargaBulanan(usaha, 10)).toBe(149000);
    expect(hargaBulanan(usaha, 18)).toBe(149000 + 3 * 5000);
  });
});
