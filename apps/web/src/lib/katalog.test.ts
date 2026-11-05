import { describe, expect, test } from "vitest";
import { hariIso, tautanWa } from "./katalog";

describe("tautan WhatsApp katalog", () => {
  test("nomor 62 dan teks di-encode", () => {
    expect(tautanWa("6281299998888", "Halo Toko, saya mau pesan Sampo herbal (Rp45.000).")).toBe(
      "https://wa.me/6281299998888?text=Halo%20Toko%2C%20saya%20mau%20pesan%20Sampo%20herbal%20(Rp45.000).",
    );
  });
  test("nomor tidak berawalan 62 ditolak", () => {
    expect(tautanWa("081299998888", "x")).toBeNull();
    expect(tautanWa("62", "x")).toBeNull();
  });
});

describe("hari ISO", () => {
  test("5 Nov 2026 Kamis = 4, 8 Nov 2026 Minggu = 7", () => {
    expect(hariIso("2026-11-05")).toBe(4);
    expect(hariIso("2026-11-08")).toBe(7);
  });
});
