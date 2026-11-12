import { describe, expect, it } from "vitest";
import { alihDomainLama, HOST_LAMA, JALUR_PUBLIK, TIDAK_DIALIHKAN, TUJUAN } from "./alih-domain";
import { halamanPublik } from "./peta-situs";

// Pencocok sederhana pola redirects Next: segmen tetap, atau akhiran /:path* untuk nol atau lebih segmen.
const cocok = (pola: string, jalur: string) =>
  pola.endsWith("/:path*") ? jalur.startsWith(pola.slice(0, -"/:path*".length) + "/") : pola === jalur;
const dialihkan = (jalur: string) => JALUR_PUBLIK.some((p) => cocok(p, jalur));

describe("alih domain lama", () => {
  it("setiap aturan hanya berlaku untuk host lama, permanen, dan ke domain utama dengan jalur sama", () => {
    for (const r of alihDomainLama()) {
      expect(r.has).toEqual([{ type: "host", value: HOST_LAMA }]);
      expect(r.permanent).toBe(true);
      expect(r.destination).toBe(`${TUJUAN}${r.source}`);
    }
  });

  it("semua halaman di sitemap ikut dialihkan", () => {
    for (const h of halamanPublik()) {
      expect(dialihkan(h.id), h.id).toBe(true);
      if (h.en) expect(dialihkan(h.en), h.en).toBe(true);
    }
  });

  it("API, autentikasi, sesi, dan tautan pribadi tidak pernah dialihkan", () => {
    for (const t of TIDAK_DIALIHKAN) {
      for (const contoh of [t.endsWith("/") ? `${t}abc` : t, `${t.replace(/\/$/, "")}/abc/def`]) expect(dialihkan(contoh), contoh).toBe(false);
    }
    expect(dialihkan("/api/mcp")).toBe(false);
    expect(dialihkan("/auth/konfirmasi")).toBe(false);
  });
});
