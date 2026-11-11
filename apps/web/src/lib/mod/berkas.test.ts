import { describe, expect, it } from "vitest";
import { bacaBerkasMod, berkasEkspor, namaBerkas } from "./berkas";
import { KATALOG_RESMI } from "./katalog";
import { periksaManifest } from "./pengawas";

describe("berkas fitur (X-17)", () => {
  const m = KATALOG_RESMI[1].manifest;
  it("ekspor lalu impor menghasilkan manifest yang sama dan tetap lolos pengawas", () => {
    const teks = berkasEkspor(m, 3, new Date("2026-11-11T00:00:00Z"));
    expect(JSON.parse(teks)).toMatchObject({ format: "nadi-mod", versi_format: 1, versi_fitur: 3, diekspor: "2026-11-11T00:00:00.000Z" });
    const r = bacaBerkasMod(teks);
    expect("manifest" in r && r.manifest).toEqual(m);
    expect(periksaManifest("manifest" in r ? r.manifest : null)).toEqual([]);
  });
  it("berkas tidak memuat data usaha: hanya kunci format dan manifest", () => {
    expect(Object.keys(JSON.parse(berkasEkspor(m, 1))).sort()).toEqual(["diekspor", "format", "manifest", "versi_fitur", "versi_format"]);
    expect(berkasEkspor(m, 1)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });
  it("manifest polos dan BOM diterima; format asing, versi asing, bukan JSON, terlalu besar ditolak", () => {
    expect("manifest" in bacaBerkasMod("﻿" + JSON.stringify(m))).toBe(true);
    expect(bacaBerkasMod(JSON.stringify({ format: "lain", manifest: m }))).toEqual({ galat: "Berkas ini bukan berkas fitur Nadi." });
    expect("galat" in bacaBerkasMod(JSON.stringify({ format: "nadi-mod", versi_format: 2, manifest: m }))).toBe(true);
    expect("galat" in bacaBerkasMod(JSON.stringify({ format: "nadi-mod", versi_format: 1, manifest: [1] }))).toBe(true);
    expect("galat" in bacaBerkasMod("{kode: 1")).toBe(true);
    expect("galat" in bacaBerkasMod("[]")).toBe(true);
    expect("galat" in bacaBerkasMod("  ")).toBe(true);
    expect("galat" in bacaBerkasMod(JSON.stringify({ x: "a".repeat(70_000) }))).toBe(true);
  });
  it("nama berkas hanya huruf kecil, angka, dan tanda hubung", () => {
    expect(namaBerkas("log-rapat", 2)).toBe("nadi-fitur-log-rapat-v2.json");
    expect(namaBerkas("a/../b\"c", null)).toBe("nadi-fitur-abc.json");
  });
});
