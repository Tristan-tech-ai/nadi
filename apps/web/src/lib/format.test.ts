import { describe, expect, it } from "vitest";
import { formatAngka, formatJam, formatPersen, formatRupiah, formatTanggal, formatTanggalKalender, waktuLokalKeIso } from "./format";

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
  it("tanggal WITA", () => expect(formatTanggal(t, "Asia/Makassar")).toBe("31 Okt 2026"));
  it("jam WITA bertitik", () => expect(formatJam(t, "Asia/Makassar")).toBe("14.30 WITA"));
  it("jam WIB", () => expect(formatJam(t, "Asia/Jakarta")).toBe("13.30 WIB"));
  it("pergantian hari ikut zona", () => expect(formatTanggal(new Date("2026-10-31T17:30:00Z"), "Asia/Jayapura")).toBe("1 Nov 2026"));
  it("23.30 lokal tetap hari itu di zona usaha (Q-25)", () => {
    // 31 Okt 23.30 WIB = 1 Nov 00.30 WITA.
    const wib = new Date("2026-10-31T16:30:00Z");
    expect(formatJam(wib, "Asia/Jakarta")).toBe("23.30 WIB");
    expect(formatTanggal(wib, "Asia/Jakarta")).toBe("31 Okt 2026");
    // 31 Okt 23.30 WIT = 31 Okt 22.30 WITA.
    const wit = new Date("2026-10-31T14:30:00Z");
    expect(formatJam(wit, "Asia/Jayapura")).toBe("23.30 WIT");
    expect(formatJam(wit, "Asia/Jayapura", false)).toBe("23.30");
    expect(formatTanggal(wit, "Asia/Jayapura")).toBe("31 Okt 2026");
  });
  it("zona wajib diisi pemanggil, tanpa bawaan WITA (Q-25)", () => {
    // Function.length berhenti di parameter pertama yang punya bawaan.
    expect(formatTanggal.length).toBe(2);
    expect(formatJam.length).toBe(2);
  });
});

describe("tanggal kalender dan isian jam lokal (Q-25)", () => {
  it("tanggal kalender YYYY-MM-DD tanpa zona", () => {
    expect(formatTanggalKalender("2026-10-31")).toBe("31 Okt 2026");
    expect(formatTanggalKalender("2027-01-05")).toBe("5 Jan 2027");
    expect(formatTanggalKalender("bukan tanggal")).toBe("bukan tanggal");
  });
  it("jam yang diketik dibaca di zona usaha", () => {
    expect(waktuLokalKeIso("2026-11-02T17:00", "Asia/Jakarta")).toBe("2026-11-02T10:00:00.000Z");
    expect(waktuLokalKeIso("2026-11-02T17:00", "Asia/Makassar")).toBe("2026-11-02T09:00:00.000Z");
    expect(waktuLokalKeIso("2026-11-02T17:00", "Asia/Jayapura")).toBe("2026-11-02T08:00:00.000Z");
    // 23.30 lokal: tanggal UTC sama untuk WIB, tetapi untuk WIT tetap di hari itu juga.
    expect(waktuLokalKeIso("2026-10-31T23:30", "Asia/Jakarta")).toBe("2026-10-31T16:30:00.000Z");
    expect(waktuLokalKeIso("2026-10-31T23:30", "Asia/Jayapura")).toBe("2026-10-31T14:30:00.000Z");
    // Lewat tengah malam lokal: 00.30 WIB 1 Nov = 31 Okt 17.30 UTC.
    expect(waktuLokalKeIso("2026-11-01T00:30", "Asia/Jakarta")).toBe("2026-10-31T17:30:00.000Z");
  });
  it("zona bermusim panas dihitung dengan selisih saat itu", () => {
    expect(waktuLokalKeIso("2026-07-01T09:00", "Europe/Amsterdam")).toBe("2026-07-01T07:00:00.000Z");
    expect(waktuLokalKeIso("2026-12-01T09:00", "Europe/Amsterdam")).toBe("2026-12-01T08:00:00.000Z");
  });
  it("isian yang bukan tanggal dan jam ditolak", () => {
    expect(waktuLokalKeIso("2026-11-02", "Asia/Jakarta")).toBeNull();
    expect(waktuLokalKeIso("2026-11-02T17:00:00+08:00", "Asia/Jakarta")).toBeNull();
    expect(waktuLokalKeIso("2026-02-30T10:00", "Asia/Jakarta")).toBeNull();
    expect(waktuLokalKeIso("2026-11-02T24:00", "Asia/Jakarta")).toBeNull();
  });
});

it("formatPersen", () => expect(formatPersen(0.92)).toBe("92%"));
it("formatAngka", () => {
  expect(formatAngka(20021)).toBe("20.021");
  expect(formatAngka(0)).toBe("0");
  expect(formatAngka(7499.6)).toBe("7.500");
});

describe("format per bahasa (I-02)", () => {
  it("rupiah en memakai koma ribuan, id tetap EYD", () => {
    expect(formatRupiah(1250000, { bahasa: "en" })).toBe("Rp1,250,000");
    expect(formatRupiah(1250000)).toBe("Rp1.250.000");
    expect(formatRupiah(1250000, { ringkas: true, bahasa: "en" })).toBe("Rp1.25M");
    expect(formatRupiah(850000, { ringkas: true, bahasa: "en" })).toBe("Rp850K");
  });
  it("tanggal dan angka en", () => {
    expect(formatTanggal(new Date("2026-10-31T03:00:00Z"), "Asia/Makassar", "en")).toBe("31 Oct 2026");
    expect(formatTanggalKalender("2026-08-17", "en")).toBe("17 Aug 2026");
    expect(formatTanggalKalender("2026-08-17")).toBe("17 Agu 2026");
    expect(formatAngka(20021, "en")).toBe("20,021");
  });
});
