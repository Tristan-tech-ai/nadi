import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DASAR_TERDAMPAK, perluCatatan } from "./uu-ketenagakerjaan";

// Q-52: setiap layar yang menyebut dasar aturan yang dicabut atau terdampak UU 27/2026 wajib memasang CatatanUuBaru.
const SRC = join(__dirname, "..", "..");

function berkas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? berkas(p) : /\.tsx$/.test(n) ? [p] : [];
  });
}
/** Isi berkas tanpa komentar: yang dicek hanya teks yang bisa tampil. */
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// Komponen yang tampil di dalam halaman yang sudah memasang catatan (bukan halaman sendiri).
const DI_DALAM: Record<string, string> = {
  "components/app/kolam.tsx": "kartu kolam insentif tampil di halaman Gaji yang memasang catatan",
};
// Layar yang menyebut dasar terdampak lewat kamus (bukan teks di berkas): wajib memasang catatan juga.
const LEWAT_KAMUS = ["app/app/gaji/page.tsx", "app/app/jadwal/page.tsx", "app/app/serah-terima/page.tsx", "app/kamus/[slug]/page.tsx"];

describe("catatan UU 27/2026", () => {
  it("muncul untuk dasar terdampak sejak 28 Okt 2026, tidak untuk aturan lain atau sebelum berlaku", () => {
    expect(perluCatatan("PP 35/2021 Pasal 40", "2026-11-12")).toBe(true);
    expect(perluCatatan("Pasal 157 UU 13/2003 yang diubah UU 6/2023", "2026-11-12")).toBe(true);
    expect(perluCatatan("mengikuti PP 36/2021 Pasal 17", "2026-10-28")).toBe(true);
    expect(perluCatatan("PP 35/2021 Pasal 31", "2026-10-27")).toBe(false);
    expect(perluCatatan("Permenaker 6/2016", "2026-11-12")).toBe(false);
    expect(perluCatatan("PPh 21 TER PP 58/2023", "2026-11-12")).toBe(false);
    expect(perluCatatan("PP 35/2021", "2026-11-12", true)).toBe(false);
  });

  it("setiap .tsx yang menampilkan dasar terdampak memasang CatatanUuBaru", () => {
    const kurang = berkas(SRC)
      .map((p) => relative(SRC, p).replaceAll("\\", "/"))
      .filter((r) => !r.startsWith("components/app/catatan-uu-baru") && !DI_DALAM[r])
      .filter((r) => DASAR_TERDAMPAK.test(tanpaKomentar(readFileSync(join(SRC, r), "utf8"))))
      .filter((r) => !readFileSync(join(SRC, r), "utf8").includes("CatatanUuBaru"));
    expect(kurang).toEqual([]);
  });

  it("layar yang memakai teks kamus berdasar terdampak juga memasang catatan", () => {
    for (const r of LEWAT_KAMUS) expect(readFileSync(join(SRC, r), "utf8"), r).toContain("CatatanUuBaru");
  });
});
