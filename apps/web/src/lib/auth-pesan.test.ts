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
  // Q-01: browser membuang tab/baris baru dari URL, jadi "/\t/x" menjadi "//x" (protocol-relative).
  it("tab atau baris baru di depan ditolak", () => {
    for (const x of ["/\t/jahat.example", "/\n/jahat.example", "/\r/jahat.example", "/\t\t/jahat.example/app"]) expect(jalurAman(x), JSON.stringify(x)).toBe("/app");
  });
  it("backslash di mana pun ditolak", () => expect(jalurAman("/app\\..\\..\\jahat")).toBe("/app"));
  it("kueri dan fragmen internal dipertahankan", () => expect(jalurAman("/oauth/izinkan?client_id=a%2Fb&state=x#z")).toBe("/oauth/izinkan?client_id=a%2Fb&state=x#z"));
});

describe("pesan auth bahasa Inggris", () => {
  it("kode dikenal dan pesan umum", async () => {
    const { kamusEn } = await import("@/lib/i18n/kamus/en");
    expect(pesanGalatAuth("invalid_credentials", kamusEn.authPesan)).toMatch(/does not match/);
    expect(pesanGalatAuth("zzz", kamusEn.authPesan)).toMatch(/entries are kept/);
    expect(cekIsianDaftar("made", "rahasia123", kamusEn.authPesan)).toMatch(/email/);
  });
});
