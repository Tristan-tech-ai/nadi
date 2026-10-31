import { describe, expect, it } from "vitest";
import { BATAS_CV, kodeSah, periksaLamaran } from "./lamar";

describe("lamar tanpa akun", () => {
  it("kode lowongan 8 karakter tanpa I, O, 0, 1; huruf kecil diterima", () => {
    expect(kodeSah("VYPD9SJ6")).toBe(true);
    expect(kodeSah("vypd9sj6")).toBe(true);
    expect(kodeSah("VYPD9SJ")).toBe(false);
    expect(kodeSah("VYPD9SJ0")).toBe(false);
    expect(kodeSah("IYPD9SJ6")).toBe(false);
  });
  it("isian lengkap lolos; yang kurang mendapat pesan jelas", () => {
    const ok = { nama: "Dewi Lestari", telepon: "0812 3456 7890", mime: "application/pdf", ukuran: 120_000 };
    expect(periksaLamaran(ok)).toBeNull();
    expect(periksaLamaran({ ...ok, nama: " " })).toMatch(/nama/);
    expect(periksaLamaran({ ...ok, telepon: "0812" })).toMatch(/nomor HP/);
    expect(periksaLamaran({ ...ok, mime: "image/gif" })).toMatch(/foto atau PDF/);
    expect(periksaLamaran({ ...ok, mime: null })).toMatch(/foto atau PDF/);
    expect(periksaLamaran({ ...ok, ukuran: BATAS_CV + 1 })).toMatch(/10 MB/);
  });
});
