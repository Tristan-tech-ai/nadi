import { describe, expect, it } from "vitest";
import { adaBahasa, jalurBahasa, lokalIntl, pilihBahasa } from "./bahasa";

describe("bahasa", () => {
  it("hanya id dan en yang dikenal", () => {
    expect(adaBahasa("en")).toBe(true);
    expect(adaBahasa("fr")).toBe(false);
    expect(adaBahasa(undefined)).toBe(false);
  });
  it("pilihan tersimpan menang, lalu cookie, lalu bawaan id", () => {
    expect(pilihBahasa("en", "id")).toBe("en");
    expect(pilihBahasa(undefined, "en")).toBe("en");
    expect(pilihBahasa(null, "xx")).toBe("id");
  });
  it("jalur bahasa bolak-balik", () => {
    expect(jalurBahasa("/", "en")).toBe("/en");
    expect(jalurBahasa("/harga", "en")).toBe("/en/harga");
    expect(jalurBahasa("/en", "id")).toBe("/");
    expect(jalurBahasa("/en/harga", "id")).toBe("/harga");
    expect(jalurBahasa("/entri", "id")).toBe("/entri");
  });
  it("lokal Intl", () => {
    expect(lokalIntl("en")).toBe("en-US");
    expect(lokalIntl("id")).toBe("id-ID");
  });
});

describe("tujuan pemilih bahasa", () => {
  it("halaman dua bahasa dipetakan, yang belum ke beranda bahasa tujuan", async () => {
    const { tujuanPemilih } = await import("./bahasa");
    expect(tujuanPemilih("/", "en")).toBe("/en");
    expect(tujuanPemilih("/en", "id")).toBe("/");
    expect(tujuanPemilih("/harga", "en")).toBe("/en/harga");
    expect(tujuanPemilih("/keamanan", "en")).toBe("/en/keamanan");
    expect(tujuanPemilih("/privasi", "en")).toBe("/en/privasi");
    expect(tujuanPemilih("/tentang", "en")).toBe("/en");
  });
});
