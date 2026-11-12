import { describe, expect, it } from "vitest";
import { HARI_KORPUS, KORPUS, KORPUS_TAMBAHAN } from "./korpus";
import { uraiTanya, uraiTanyaBanyak } from "./urai";

// M-22B: rentang tanggal bebas dan pertanyaan gabungan. Ambang ditulis sebelum pengurai diubah.
const ringkas = (t: { niat: string; dari: string; sampai: string }) => `${t.niat} ${t.dari} ${t.sampai}`;

describe("tanya gabungan dan rentang bebas", () => {
  it("korpus tambahan 15 kalimat: minimal 80% persis", () => {
    const salah: string[] = [];
    for (const [kalimat, harap] of KORPUS_TAMBAHAN) {
      const hasil = uraiTanyaBanyak(kalimat, HARI_KORPUS).map(ringkas);
      if (JSON.stringify(hasil) !== JSON.stringify(harap.map(ringkas))) salah.push(`${kalimat} -> ${hasil.join(" | ")}`);
    }
    expect(KORPUS_TAMBAHAN.length).toBe(15);
    expect((KORPUS_TAMBAHAN.length - salah.length) / KORPUS_TAMBAHAN.length, salah.join("\n")).toBeGreaterThanOrEqual(0.8);
  });

  it("korpus lama 50 kalimat lewat uraiTanyaBanyak tetap minimal 90% dan sama dengan uraiTanya untuk kalimat satu ukuran", () => {
    let benar = 0;
    for (const [kalimat, harap] of KORPUS) {
      const banyak = uraiTanyaBanyak(kalimat, HARI_KORPUS);
      const hasil = harap === null ? banyak.length === 0 : banyak.length === 1 && ringkas(banyak[0]) === ringkas(harap) && (banyak[0].cari ?? null) === (harap.cari ?? null);
      if (hasil) benar++;
      if (banyak.length <= 1) expect(banyak[0] ?? null).toEqual(uraiTanya(kalimat, HARI_KORPUS));
    }
    expect(benar / KORPUS.length).toBeGreaterThanOrEqual(0.9);
  });

  it("rentang tidak sah ditolak dan pertanyaan berbahaya tetap ditolak", () => {
    expect(uraiTanya("penjualan 31-35 november", HARI_KORPUS)?.dari).not.toBe("2026-11-31");
    expect(uraiTanyaBanyak("penjualan dan laba paling bagus kenapa", HARI_KORPUS)).toEqual([]);
    expect(uraiTanyaBanyak("penjualan dan laba dan kas dan pengeluaran", HARI_KORPUS).length).toBe(3);
  });
});
