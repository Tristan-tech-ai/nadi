import { describe, expect, it } from "vitest";
import { cekTemplat, periodeNomor, romawi, susunNomor } from "./templat";

// Tabel contoh yang sama dengan supabase/tests/nomor_sakti.test.sql (app.susun_nomor dan app.periode_nomor):
// pratinjau di layar harus sama persis dengan nomor yang nanti diterbitkan database.
describe("susunNomor sama dengan app.susun_nomor", () => {
  it.each([
    ["{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}", 12, "WRG", "SK", "2026-11-01", "012/WRG/SK/XI/2026"],
    ["{jenis}-{tahun2}-{bulan}-{no}", 7, "X", "INV", "2026-01-31", "INV-26-01-7"],
    ["{no:3}", 1234, null, "SK", "2026-11-01", "1234"],
    ["{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}", 1, "WRG", "SK", "2026-12-31", "001/WRG/SK/XII/2026"],
    ["INV/{tahun}/{bulan}/{no:4}", 1, null, "INV", "2026-11-01", "INV/2026/11/0001"],
    ["{kode}/{no}", 5, null, "ST", "2026-11-01", "/5"],
  ])("%s urut %i", (templat, urut, kode, jenis, tanggal, harap) => {
    expect(susunNomor(templat, urut, kode, jenis, tanggal)).toBe(harap);
  });
});

describe("periodeNomor sama dengan app.periode_nomor", () => {
  it("bulanan bila ada {bulan} atau {bulan_romawi}", () => {
    expect(periodeNomor("{no}/{bulan_romawi}/{tahun}", "2026-11-30")).toBe("2026-11");
    expect(periodeNomor("{no}-{bulan}", "2026-01-01")).toBe("2026-01");
  });
  it("tahunan bila hanya {tahun} atau {tahun2}", () => {
    expect(periodeNomor("{no}/{tahun2}", "2026-11-30")).toBe("2026");
  });
  it("tidak pernah reset tanpa token waktu", () => {
    expect(periodeNomor("{jenis}-{no:4}", "2026-11-30")).toBe("selamanya");
  });
});

describe("romawi", () => {
  it("1..12", () => {
    expect([1, 4, 9, 11, 12].map(romawi)).toEqual(["I", "IV", "IX", "XI", "XII"]);
  });
});

describe("cekTemplat sama dengan penolakan atur_templat_nomor", () => {
  it("menerima templat dengan token dikenal", () => {
    expect(cekTemplat("{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}")).toBeNull();
  });
  it("menolak token tidak dikenal", () => {
    expect(cekTemplat("{no}/{hari}")).toMatch(/tidak dikenal/);
  });
  it("menolak templat tanpa {no}", () => {
    expect(cekTemplat("SK/{tahun}")).toMatch(/\{no\}/);
  });
  it("menolak kurung yang tidak berpasangan", () => {
    expect(cekTemplat("{no}/{tahun")).toMatch(/tidak dikenal/);
  });
});
