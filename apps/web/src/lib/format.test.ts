import { describe, expect, it } from "vitest";
import { formatAngka, formatJam, formatPersen, formatRupiah, formatTanggal } from "./format";

describe("formatRupiah", () => {
  it("tanpa spasi dan tanpa titik setelah Rp, titik ribuan", () => expect(formatRupiah(1250000)).toBe("Rp1.250.000"));
  it("desimal pakai koma", () => expect(formatRupiah(12500.5)).toBe("Rp12.500,5"));
  it("nol", () => expect(formatRupiah(0)).toBe("Rp0"));
  it("negatif", () => expect(formatRupiah(-75000)).toBe("-Rp75.000"));
  it("bukan angka jadi Rp0", () => expect(formatRupiah(Number.NaN)).toBe("Rp0"));
  it("ringkas juta", () => expect(formatRupiah(1250000, { ringkas: true })).toBe("Rp1,25 jt"));
  it("ringkas ribu", () => expect(formatRupiah(850000, { ringkas: true })).toBe("Rp850 rb"));
  it("ringkas miliar", () => expect(formatRupiah(3100000000, { ringkas: true })).toBe("Rp3,1 M"));
  it("ringkas di bawah seribu tetap utuh", () => expect(formatRupiah(500, { ringkas: true })).toBe("Rp500"));
});

describe("formatTanggal dan formatJam", () => {
  const t = new Date("2026-10-31T06:30:00Z");
  it("tanggal WITA", () => expect(formatTanggal(t)).toBe("31 Okt 2026"));
  it("jam WITA bertitik", () => expect(formatJam(t)).toBe("14.30 WITA"));
  it("jam WIB", () => expect(formatJam(t, "Asia/Jakarta")).toBe("13.30 WIB"));
  it("pergantian hari ikut zona", () => expect(formatTanggal(new Date("2026-10-31T17:30:00Z"), "Asia/Jayapura")).toBe("1 Nov 2026"));
});

it("formatPersen", () => expect(formatPersen(0.92)).toBe("92%"));
it("formatAngka", () => {
  expect(formatAngka(20021)).toBe("20.021");
  expect(formatAngka(0)).toBe("0");
  expect(formatAngka(7499.6)).toBe("7.500");
});
