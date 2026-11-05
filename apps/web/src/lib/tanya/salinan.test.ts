import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { periksaAturanTanya } from "../../../../../supabase/functions/pelajari-tanya/pengawas";
import { uraiTanya } from "@/lib/tanya/urai";

// T-01A: pengawas di Edge Function memakai pengurai yang persis sama dengan aplikasi.
describe("belajar tanya data (T-01A)", () => {
  it("salinan urai.ts di Edge Function sama persis dengan aplikasi", () => {
    const a = readFileSync(join(__dirname, "urai.ts"), "utf8").replace(/\r\n/g, "\n");
    const b = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "supabase", "functions", "pelajari-tanya", "urai.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(b).toBe(a);
  });
  it("aturan aktif dipakai bila niat bawaan tidak ada, dengan rentang tanggal biasa", () => {
    expect(uraiTanya("berapa cuan bulan ini?", "2026-11-06")).toBeNull();
    expect(uraiTanya("berapa cuan bulan ini?", "2026-11-06", [{ kata: "cuan", niat: "laba" }])).toMatchObject({ niat: "laba", dari: "2026-11-01", sampai: "2026-11-06", aturan: "cuan" });
    // niat bawaan tetap menang atas aturan
    expect(uraiTanya("laba cuan bulan ini", "2026-11-06", [{ kata: "cuan", niat: "kas" }])?.niat).toBe("laba");
  });
  it("pengawas menerima kata yang ada di kalimat dan menolak usulan karangan", () => {
    const h = "2026-11-06";
    expect(periksaAturanTanya("berapa cuan bulan ini", "cuan", "laba", h)).toEqual({ lulus: true, alasan: [] });
    expect(periksaAturanTanya("berapa cuan bulan ini", "untung besar", "laba", h).alasan.join()).toContain("tidak ada di kalimat");
    expect(periksaAturanTanya("berapa cuan bulan ini", "bulan", "laba", h).alasan.join()).toContain("terlalu umum");
    expect(periksaAturanTanya("berapa cuan bulan ini", "cuan", "rahasia", h).alasan.join()).toContain("daftar tetap");
    expect(periksaAturanTanya("cuan 2026 ya", "cuan 2026", "laba", h).lulus).toBe(false);
    expect(periksaAturanTanya("kenapa cuan turun", "cuan", "laba", h).alasan.join()).toContain("pendapat");
    expect(periksaAturanTanya("omzet bulan ini", "omzet", "pendapatan", h).alasan.join()).toContain("bawaan");
  });
});
