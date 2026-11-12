import { describe, expect, it } from "vitest";
import { asalSitus, DOMAIN_UTAMA } from "./situs";

describe("asalSitus", () => {
  it("memakai NADI_ASAL tanpa garis miring akhir", () => {
    expect(asalSitus({ NADI_ASAL: "https://NadiUsaha.my.id/ " })).toBe("https://nadiusaha.my.id");
  });
  it("memakai domain produksi Vercel bila NADI_ASAL kosong", () => {
    expect(asalSitus({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "nadiusaha.my.id" })).toBe("https://nadiusaha.my.id");
  });
  it("jatuh ke domain utama, bukan alamat vercel.app lama", () => {
    expect(asalSitus({})).toBe(DOMAIN_UTAMA);
    expect(asalSitus({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe(DOMAIN_UTAMA);
  });
});
