import { describe, expect, it } from "vitest";
import { BATAS_QRIS, jadwalPengingat, kelompokUmur, tautanWa, teksKirim, teksPengingat, totalBaris } from "./tagihan";

describe("totalBaris", () => {
  it("jumlah x harga dibulatkan per baris ke rupiah", () => {
    expect(totalBaris([{ uraian: "Nasi kotak", jumlah: 50, harga: 25_000 }, { uraian: "Air mineral", jumlah: 1.5, harga: 3_333 }])).toBe(1_255_000);
  });
  it("baris kosong tidak dihitung", () => {
    expect(totalBaris([])).toBe(0);
  });
});

describe("jadwalPengingat", () => {
  it("H-3, jatuh tempo, H+3, H+14 dengan nada naik bertahap", () => {
    expect(jadwalPengingat("2026-11-20", "2026-11-01")).toEqual([
      { tahap: 1, tanggal: "2026-11-17" }, { tahap: 2, tanggal: "2026-11-20" }, { tahap: 3, tanggal: "2026-11-23" }, { tahap: 4, tanggal: "2026-12-04" },
    ]);
  });
  it("tahap yang tanggalnya sebelum terbit dilewati (jatuh tempo dekat)", () => {
    expect(jadwalPengingat("2026-11-02", "2026-11-01").map((p) => p.tahap)).toEqual([2, 3, 4]);
  });
});

describe("kelompokUmur", () => {
  it("belum jatuh tempo, 1-30, 31-60, 61-90, lebih dari 90", () => {
    const h = "2026-11-01";
    expect(kelompokUmur("2026-11-01", h)).toBe("belum");
    expect(kelompokUmur("2026-10-31", h)).toBe("1-30");
    expect(kelompokUmur("2026-10-02", h)).toBe("1-30");
    expect(kelompokUmur("2026-10-01", h)).toBe("31-60");
    expect(kelompokUmur("2026-08-03", h)).toBe("61-90");
    expect(kelompokUmur("2026-08-02", h)).toBe("90+");
  });
});

describe("teksPengingat", () => {
  const d = { usaha: "Warung Uji", pelanggan: "Bu Rina", nomor: "001/INV/XI/2026", total: 1_255_000, jatuhTempo: "2026-11-20", tautan: "https://nadi.contoh/i/ABCDEFGHJKLM" };
  it("tahap 1 ramah, menyebut tanggal dan tautan, tanpa kata menagih keras", () => {
    const t = teksPengingat(1, d);
    expect(t).toContain("Bu Rina");
    expect(t).toContain("20 Nov 2026");
    expect(t).toContain(d.tautan);
    expect(t).not.toMatch(/lewat|segera/);
  });
  it("tahap 4 tegas: nomor, nominal, sudah lewat berapa hari", () => {
    const t = teksPengingat(4, d);
    expect(t).toContain("001/INV/XI/2026");
    expect(t).toContain("Rp1.255.000");
    expect(t).toMatch(/lewat 14 hari/);
  });
  it("tanpa tanda pisah panjang dan tanpa emoji di semua tahap", () => {
    for (const k of [1, 2, 3, 4] as const) expect(teksPengingat(k, d)).not.toMatch(new RegExp("[\\u2013\\u2014]|\\p{Extended_Pictographic}", "u"));
  });
});

it("batas QRIS per transaksi Rp10.000.000 (BI)", () => {
  expect(BATAS_QRIS).toBe(10_000_000);
});

describe("teksKirim dan tautanWa", () => {
  const d = { usaha: "Warung Uji", pelanggan: "Bu Rina", nomor: "001/INV/XI/2026", total: 180_000, jatuhTempo: "2026-11-20", tautan: "https://nadi.contoh/i/ABCDEFGHJKLM" };
  it("pesan pertama menyebut nomor, nominal, jatuh tempo, tautan", () => {
    expect(teksKirim(d)).toBe("Halo Bu Rina, berikut invoice 001/INV/XI/2026 dari Warung Uji sebesar Rp180.000, jatuh tempo 20 Nov 2026. Rincian dan cara bayar: https://nadi.contoh/i/ABCDEFGHJKLM");
  });
  it("wa.me memakai nomor 62... dan teks ter-enkode; tanpa nomor = null", () => {
    expect(tautanWa("6281234567890", "Halo Bu & Pak")).toBe("https://wa.me/6281234567890?text=Halo%20Bu%20%26%20Pak");
    expect(tautanWa(null, "x")).toBeNull();
  });
});
