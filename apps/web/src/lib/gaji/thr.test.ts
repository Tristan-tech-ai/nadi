import { describe, expect, it } from "vitest";
import { hitungThr, hitungThrHarianLepas, masaKerjaBulan } from "./thr";

// Contoh dari rumus Permenaker 6/2016 Pasal 3 ayat (1) dan (2) huruf b; angka sama dengan tes SQL gaji_lanjutan.
describe("THR Permenaker 6/2016 (M-10)", () => {
  it("masa kerja 12 bulan atau lebih: 1 bulan upah pokok + tunjangan tetap", () => {
    expect(hitungThr({ mulai: "2024-01-15", hariRaya: "2027-03-20", pokok: 3_200_000, tunjanganTetap: 400_000 })).toMatchObject({ thr: 3_600_000 });
  });
  it("tepat 12 bulan sudah penuh", () => {
    expect(hitungThr({ mulai: "2026-03-20", hariRaya: "2027-03-20", pokok: 3_000_000 })).toMatchObject({ masa: 12, thr: 3_000_000 });
  });
  it("8 bulan: 8/12 x upah, dibulatkan ke rupiah", () => {
    expect(hitungThr({ mulai: "2026-07-20", hariRaya: "2027-03-20", pokok: 3_000_000 })).toMatchObject({ masa: 8, thr: 2_000_000 });
    expect(hitungThr({ mulai: "2026-08-01", hariRaya: "2027-03-20", pokok: 3_100_000 })).toMatchObject({ masa: 7, thr: 1_808_333 });
  });
  it("kurang dari 1 bulan tidak berhak", () => {
    expect(hitungThr({ mulai: "2027-03-01", hariRaya: "2027-03-20", pokok: 2_900_000 })).toMatchObject({ masa: 0, thr: 0 });
  });
  it("batas bayar 7 hari sebelum Hari Raya", () => {
    expect(hitungThr({ mulai: "2020-01-01", hariRaya: "2027-03-20", pokok: 1 }).batasBayar).toBe("2027-03-13");
  });
  it("bulan penuh seperti age() Postgres", () => {
    expect(masaKerjaBulan("2026-07-20", "2027-03-19")).toBe(7);
    expect(masaKerjaBulan("2026-01-31", "2026-02-28")).toBe(0);
    expect(masaKerjaBulan("2026-01-31", "2026-03-31")).toBe(2);
  });
});

// M-10B: angka sama dengan tes SQL gaji_lanjutan_b (Ketut dan Nyoman).
describe("THR harian lepas Permenaker 6/2016 Pasal 3 ayat (3) (M-10B)", () => {
  it(">= 12 bulan: rata-rata 12 bulan terakhir, bulan tanpa kerja ikut dibagi", () => {
    const upah = [2_000_000, 2_000_000, 2_000_000, 2_000_000, 2_000_000, 2_600_000, 2_600_000, 2_600_000, 2_600_000, 2_600_000, 2_600_000];
    expect(hitungThrHarianLepas({ mulai: "2025-01-10", hariRaya: "2027-03-20", upahBulanan: upah })).toMatchObject({ masa: 26, thr: 2_133_333 });
  });
  it("< 12 bulan: rata-rata per bulan selama masa kerja, lalu masa/12", () => {
    const upah = [900_000, 1_800_000, 1_800_000, 1_800_000, 1_800_000, 2_100_000];
    expect(hitungThrHarianLepas({ mulai: "2026-09-05", hariRaya: "2027-03-20", upahBulanan: upah })).toMatchObject({ masa: 6, upah: 1_700_000, thr: 850_000 });
  });
  it("tanpa slip: belum bisa dihitung", () => {
    expect(hitungThrHarianLepas({ mulai: "2026-01-05", hariRaya: "2027-03-20", upahBulanan: [] })).toMatchObject({ thr: null });
  });
});
