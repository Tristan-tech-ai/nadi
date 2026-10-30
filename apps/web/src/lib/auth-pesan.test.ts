import { describe, expect, it } from "vitest";
import { cekIsianDaftar, jalurAman, pesanGalatAuth } from "./auth-pesan";

describe("pesanGalatAuth", () => {
  it("kode dikenal", () => expect(pesanGalatAuth("invalid_credentials")).toMatch(/tidak cocok/));
  it("kode tak dikenal memberi pesan umum yang menenangkan", () => expect(pesanGalatAuth("zzz")).toMatch(/isianmu tidak hilang/));
  it("tanpa kode", () => expect(pesanGalatAuth(undefined)).toMatch(/Coba lagi/));
});

describe("cekIsianDaftar", () => {
  it("email salah", () => expect(cekIsianDaftar("made", "rahasia123")).toMatch(/email/));
  it("sandi pendek", () => expect(cekIsianDaftar("made@warung.id", "123")).toMatch(/8 karakter/));
  it("isian benar", () => expect(cekIsianDaftar("made@warung.id", "rahasia123")).toBeNull());
});

describe("jalurAman", () => {
  it("jalur internal lolos", () => expect(jalurAman("/app/usulan?x=1")).toBe("/app/usulan?x=1"));
  it("URL luar ditolak", () => expect(jalurAman("https://jahat.example")).toBe("/app"));
  it("protocol-relative ditolak", () => expect(jalurAman("//jahat.example")).toBe("/app"));
  it("backslash ditolak", () => expect(jalurAman("/\\jahat.example")).toBe("/app"));
  it("kosong memakai cadangan", () => expect(jalurAman(null, "/masuk")).toBe("/masuk"));
});
