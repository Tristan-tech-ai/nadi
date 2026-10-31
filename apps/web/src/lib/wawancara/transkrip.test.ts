import { describe, expect, it } from "vitest";
import { BATAS_TRANSKRIP, jadiMono, rapikanTranskrip } from "./transkrip";

describe("jadiMono", () => {
  it("satu kanal apa adanya, dua kanal dijumlah dengan skala 1/sqrt(2)", () => {
    const a = new Float32Array([0.5, -0.5]);
    expect(jadiMono([a])).toBe(a);
    const m = jadiMono([new Float32Array([1, 0]), new Float32Array([1, 1])]);
    expect(m[0]).toBeCloseTo(2 * Math.SQRT1_2, 5);
    expect(m[1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(jadiMono([])).toHaveLength(0);
  });
});

describe("rapikanTranskrip", () => {
  it("membuang penanda bukan ucapan dan spasi berlebih", () => {
    expect(rapikanTranskrip("  [Musik]  Saya pernah   jadi pelayan. (tertawa) ")).toBe("Saya pernah jadi pelayan.");
  });
  it("dipotong sesuai batas database", () => {
    expect(rapikanTranskrip("a".repeat(BATAS_TRANSKRIP + 10))).toHaveLength(BATAS_TRANSKRIP);
  });
});
