import { describe, expect, it } from "vitest";
import { tautanTablet, tokenDariHash, tokenSah } from "./kios";

const t = "nmk_" + "ab12".repeat(16);

describe("tautan tablet absen", () => {
  it("token dibaca dari fragmen dengan atau tanpa t=", () => {
    expect(tokenDariHash("#" + t)).toBe(t);
    expect(tokenDariHash("#t=" + t)).toBe(t);
  });
  it("fragmen kosong, token pendek, huruf besar, atau awalan lain ditolak", () => {
    expect(tokenDariHash("")).toBeNull();
    expect(tokenDariHash("#nmk_abc")).toBeNull();
    expect(tokenDariHash("#" + t.toUpperCase())).toBeNull();
    expect(tokenDariHash("#nmc_" + "ab12".repeat(16))).toBeNull();
    expect(tokenSah(null)).toBe(false);
  });
  it("tautan memakai fragmen, bukan query, agar token tidak masuk log server", () => {
    const u = tautanTablet("https://nadi.contoh.id/", t);
    expect(u).toBe(`https://nadi.contoh.id/kios/tablet#${t}`);
    expect(new URL(u).search).toBe("");
  });
});
