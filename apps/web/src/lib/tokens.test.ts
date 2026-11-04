import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AKSEN, kontras, POSTER, WARNA, type NamaWarna } from "./tokens";

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

describe("lapangan poster (Persuade): kontras kedua tema", () => {
  for (const m of MODE) {
    for (const [nama, nilai] of Object.entries(POSTER)) {
      const [latar, tinta] = nilai[m];
      it(`tinta di lapangan ${nama} (${m}) >= 4,5:1`, () => expect(kontras(tinta, latar)).toBeGreaterThanOrEqual(4.5));
    }
    for (const nama of ["tinta", "laut"] as const) {
      it(`sorot di lapangan ${nama} (${m}) >= 4,5:1`, () => expect(kontras(AKSEN.sorot[m], POSTER[nama][m][0])).toBeGreaterThanOrEqual(4.5));
    }
    it(`sorot di lapangan cap (${m}) >= 3:1 (hanya judul besar)`, () => expect(kontras(AKSEN.sorot[m], POSTER.cap[m][0])).toBeGreaterThanOrEqual(3));
    for (const nama of ["stempel", "lunas"] as const) {
      it(`${nama} di lembar (${m}) >= 4,5:1`, () => expect(kontras(AKSEN[nama][m], POSTER.lembar[m][0])).toBeGreaterThanOrEqual(4.5));
    }
  }
  it("tidak ada lapangan berwarna ungu (rona 250-300)", () => {
    for (const nilai of Object.values(POSTER)) for (const m of MODE) expect(rona(nilai[m][0]) < 250 || rona(nilai[m][0]) > 300 || jenuh(nilai[m][0]) < 0.15).toBe(true);
  });
  it("globals.css memuat nilai poster yang sama", () => {
    const terang = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {"))).toLowerCase();
    const gelap = css.slice(css.indexOf(':root[data-tema="gelap"]'), css.indexOf("}", css.indexOf(':root[data-tema="gelap"]'))).toLowerCase();
    for (const [nama, nilai] of Object.entries(POSTER)) {
      expect(terang).toContain(`--poster-${nama}: ${nilai.terang[0].toLowerCase()};`);
      expect(terang).toContain(`--poster-${nama}-tinta: ${nilai.terang[1].toLowerCase()};`);
      expect(gelap).toContain(`--poster-${nama}: ${nilai.gelap[0].toLowerCase()};`);
      expect(gelap).toContain(`--poster-${nama}-tinta: ${nilai.gelap[1].toLowerCase()};`);
    }
    for (const [nama, nilai] of Object.entries(AKSEN)) {
      expect(terang).toContain(`--${nama}: ${nilai.terang.toLowerCase()};`);
      expect(gelap).toContain(`--${nama}: ${nilai.gelap.toLowerCase()};`);
    }
  });
});

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function jenuh(hex: string) {
  const c = rgb(hex);
  return Math.max(...c) - Math.min(...c);
}
function rona(hex: string) {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1;
  if (mx === r) return (60 * ((g - b) / d) + 360) % 360;
  if (mx === g) return 60 * ((b - r) / d) + 120;
  return 60 * ((r - g) / d) + 240;
}
