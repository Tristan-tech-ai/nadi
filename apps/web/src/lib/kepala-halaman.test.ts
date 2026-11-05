import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { halamanDari } from "./ruang";

// U-03: setiap halaman /app memakai KepalaHalaman (jejak ruang, judul, tujuan, aksi, bantuan) dan tidak menulis <h1> sendiri.
const AKAR = join(__dirname, "..", "app", "app");
function halaman(dir: string): { rute: string; isi: string }[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return halaman(p);
    if (n !== "page.tsx") return [];
    const rel = relative(AKAR, dir).split(sep).join("/");
    return [{ rute: rel ? `/app/${rel}` : "/app", isi: readFileSync(p, "utf8") }];
  });
}

/** Galat kepala halaman untuk satu berkas; kosong berarti lolos. */
function periksaKepala(rute: string, isi: string): string[] {
  const galat: string[] = [];
  if (/<h1[\s>]/.test(isi)) galat.push(`${rute}: masih menulis <h1> sendiri`);
  const jalur = [...isi.matchAll(/<KepalaHalaman jalur="([^"]+)"/g)].map((m) => m[1]);
  if (jalur.length === 0) galat.push(`${rute}: tanpa KepalaHalaman`);
  for (const j of jalur) {
    if (rute === "/app/mulai" || rute === "/app/menu") continue; // di luar peta ruang: alur sebelum usaha ada, dan peta menu itu sendiri
    if (!halamanDari(j)) galat.push(`${rute}: jalur ${j} tidak ada di peta ruang`);
    else if (j !== rute && !rute.startsWith(`${j}/`) && !(rute.startsWith("/app/wawancara/") && j === "/app/rekrutmen"))
      galat.push(`${rute}: jalur ${j} bukan halaman ini`);
  }
  return galat;
}

describe("kepala halaman seragam", () => {
  it("pemeriksa menolak halaman tanpa KepalaHalaman atau dengan h1 sendiri (merah dulu)", () => {
    expect(periksaKepala("/app/invoice", '<h1 className="x">{t.judul}</h1>')).toHaveLength(2);
    expect(periksaKepala("/app/invoice", '<KepalaHalaman jalur="/app/gaji" judul="x" />')).toEqual(["/app/invoice: jalur /app/gaji bukan halaman ini"]);
    expect(periksaKepala("/app/invoice", '<KepalaHalaman jalur="/app/invoice" judul="x" />')).toEqual([]);
  });
  it("semua halaman /app lolos", () => {
    const semua = halaman(AKAR);
    expect(semua.length).toBeGreaterThan(50);
    expect(semua.flatMap((h) => periksaKepala(h.rute, h.isi))).toEqual([]);
  });
});
