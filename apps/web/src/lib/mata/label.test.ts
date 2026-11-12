import { describe, expect, it } from "vitest";
import { ambilKamus } from "@/lib/i18n/kamus";
import { labelJenisZona } from "./label";
import type { JenisZona } from "./resep";

const SEMUA: JenisZona[] = ["meja", "antrean", "rak", "kasir", "pintu", "lorong", "kerja"];

describe("labelJenisZona (Q-45)", () => {
  for (const bahasa of ["id", "en"] as const) {
    const t = ambilKamus(bahasa).mata;
    it(`setiap jenis punya label sendiri (${bahasa})`, () => {
      const label = SEMUA.map((j) => labelJenisZona(j, t));
      expect(new Set(label).size).toBe(SEMUA.length);
      expect(label.every((x) => x.trim().length > 0)).toBe(true);
    });
  }
  it("zona pintu tidak tertulis Rak", () => {
    const t = ambilKamus("id").mata;
    expect(labelJenisZona("pintu", t)).toBe("Pintu");
    expect(labelJenisZona("kasir", t)).toBe("Kasir");
    expect(labelJenisZona("kerja", t)).toBe("Pos kerja");
  });
});
