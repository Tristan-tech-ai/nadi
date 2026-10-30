import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { kontras, WARNA, type NamaWarna } from "./tokens";

const MODE = ["terang", "gelap"] as const;
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("kontras token (WCAG AA)", () => {
  const teks: NamaWarna[] = ["tinta", "tinta-2", "cap", "daun", "laut"];
  for (const m of MODE) {
    for (const fg of teks) {
      for (const bg of ["kertas", "kertas-2"] as const) {
        it(`${fg} di atas ${bg} (${m}) >= 4,5:1`, () => {
          expect(kontras(WARNA[fg][m], WARNA[bg][m])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    it(`teks tombol utama (${m}) >= 4,5:1`, () => {
      expect(kontras(WARNA.kertas[m], WARNA.tinta[m])).toBeGreaterThanOrEqual(4.5);
    });
    it(`tinta di stabilo kunyit (${m}) >= 4,5:1`, () => {
      expect(kontras(WARNA.tinta.terang, WARNA.kunyit[m])).toBeGreaterThanOrEqual(4.5);
    });
    it(`tepi kotak isian garis-kuat (${m}) >= 3:1 (WCAG 1.4.11)`, () => {
      expect(kontras(WARNA["garis-kuat"][m], WARNA.kertas[m])).toBeGreaterThanOrEqual(3);
      expect(kontras(WARNA["garis-kuat"][m], WARNA["kertas-2"][m])).toBeGreaterThanOrEqual(3);
    });
  }
  it("pemeriksa kontras bisa gagal (abu muda di putih < 4,5)", () => {
    expect(kontras("#AAAAAA", "#FFFFFF")).toBeLessThan(4.5);
  });
});

describe("globals.css sama dengan tokens.ts", () => {
  const blok = (pemilih: string) => {
    const i = css.indexOf(pemilih);
    return css.slice(i, css.indexOf("}", i));
  };
  for (const [nama, nilai] of Object.entries(WARNA)) {
    it(`--${nama} terang`, () => expect(blok(":root {").toLowerCase()).toContain(`--${nama}: ${nilai.terang.toLowerCase()};`));
    it(`--${nama} gelap`, () => expect(blok(':root[data-tema="gelap"]').toLowerCase()).toContain(`--${nama}: ${nilai.gelap.toLowerCase()};`));
  }
});
