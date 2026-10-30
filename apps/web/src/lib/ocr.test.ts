import { describe, expect, it } from "vitest";
import { AMBANG_OCR, perluOcr } from "./ocr";

describe("perluOcr", () => {
  it("hanya foto yang di-OCR", () => {
    expect(perluOcr("image/jpeg")).toBe(true);
    expect(perluOcr("image/png")).toBe(true);
    expect(perluOcr("application/pdf")).toBe(false);
    expect(perluOcr("text/csv")).toBe(false);
  });
  it("ambang keyakinan sesuai hasil riset", () => {
    expect(AMBANG_OCR).toBe(85);
  });
});
