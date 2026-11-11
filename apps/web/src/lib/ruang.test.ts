import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { DI_LUAR_MENU, RUANG, SEMUA_HALAMAN, halamanDari, ruangUntuk } from "./ruang";

const AKAR = join(__dirname, "..", "app", "app");
function halamanDisk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return halamanDisk(p);
    return n === "page.tsx" ? [`/app${relative(AKAR, dir).split(sep).join("/") ? `/${relative(AKAR, dir).split(sep).join("/")}` : ""}`] : [];
  });
}

describe("peta ruang", () => {
  it("setiap halaman /app di disk terdaftar di peta ruang atau sengaja di luar menu", () => {
    const terdaftar = new Set<string>([...SEMUA_HALAMAN.map((x) => x.href), ...DI_LUAR_MENU]);
    expect(halamanDisk(AKAR).filter((x) => !terdaftar.has(x))).toEqual([]);
  });
  it("tidak ada halaman ganda dan setiap halaman punya label serta guna dua bahasa", () => {
    const href = SEMUA_HALAMAN.map((x) => x.href);
    expect(new Set(href).size).toBe(href.length);
    for (const x of SEMUA_HALAMAN) for (const t of [x.label, x.guna]) expect(t.id.length * t.en.length, x.href).toBeGreaterThan(0);
  });
  it("10 ruang (X-06 menambah Fitur tambahan); staf tidak melihat ruang Uang selain klaim", () => {
    expect(RUANG).toHaveLength(10);
    const staf = ruangUntuk("staf");
    expect(staf.find((r) => r.id === "uang")?.halaman.map((x) => x.href)).toEqual(["/app/klaim"]);
    expect(staf.some((r) => r.id === "barang")).toBe(false);
  });
  it("jalur bersarang memakai halaman terdalam", () => {
    expect(halamanDari("/app/buku/pembiayaan")?.label.id).toBe("Paket pembiayaan");
    expect(halamanDari("/app/buku")?.ruang).toBe("uang");
    expect(halamanDari("/app")?.href).toBe("/app");
    expect(halamanDari("/app/invoice")?.ruang).toBe("uang");
  });
});
