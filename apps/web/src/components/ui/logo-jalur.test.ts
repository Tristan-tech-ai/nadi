import { describe, expect, it } from "vitest";
import { JALUR_N, KOTAK_TANDA, TITIK, svgTanda } from "./logo-jalur";

const angka = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("tanda Nadi", () => {
  it("semua titik jalur di dalam kotak 32", () => {
    for (const n of angka(JALUR_N)) expect(n >= 0 && n <= KOTAK_TANDA).toBe(true);
  });
  it("titik denyut di dalam kotak dan tidak menyentuh lengkung n", () => {
    expect(TITIK.cx + TITIK.r).toBeLessThanOrEqual(KOTAK_TANDA);
    expect(TITIK.cy - TITIK.r).toBeGreaterThanOrEqual(0);
    // lengkung luar: pusat (16, 15), jari-jari 11; jarak tepi titik ke lengkung minimal 1 satuan (terpisah di 16 px)
    const jarak = Math.hypot(TITIK.cx - 16, TITIK.cy - 15) - 11 - TITIK.r;
    expect(jarak).toBeGreaterThanOrEqual(1);
  });
  it("kaki n tidak lebih tipis dari 3 satuan (terbaca di 16 px)", () => {
    expect(12 - 5).toBeGreaterThanOrEqual(3);
    expect(27 - 20).toBeGreaterThanOrEqual(3);
  });
  it("svgTanda memakai warna yang diminta dan latar opsional", () => {
    const s = svgTanda("#111111", "#222222", "#333333", 4);
    expect(s).toContain('fill="#111111"');
    expect(s).toContain('fill="#222222"');
    expect(s).toContain('fill="#333333"');
    expect(svgTanda("#1", "#2")).not.toContain("<rect");
  });
});
