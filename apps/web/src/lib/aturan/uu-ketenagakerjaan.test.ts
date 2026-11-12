import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { kamusId } from "@/lib/i18n/kamus/id";
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

// Q-56: bagian kamus (kunci tingkat atas) yang teksnya menyebut dasar terdampak, dan layar yang menampilkan teks itu.
// Bagian baru yang menyebut dasar terdampak membuat tes gagal sampai layarnya dipetakan dan memasang CatatanUuBaru.
const LAYAR_BAGIAN: Record<string, string[]> = {
  gaji: ["app/app/gaji/page.tsx"],
  kolam: ["app/app/gaji/page.tsx", "app/app/kerja/page.tsx"],
  aturanKerja: ["app/app/perusahaan/page.tsx"],
  serahTerima: ["app/app/serah-terima/page.tsx"],
  serahPesan: ["app/app/serah-terima/page.tsx"],
  hakBerhenti: ["app/app/serah-terima/page.tsx"],
  proyek: ["app/app/proyek/page.tsx"],
  kasbon: ["app/app/gaji/kasbon/page.tsx", "app/app/gaji/page.tsx"],
  hr: ["app/app/orang/kerja/page.tsx"],
  panduanHalaman: ["components/landing/halaman-panduan.tsx"],
  fitur: ["components/poster/halaman-fitur.tsx"],
  // isi.hari (cerita satu hari, en menyebut PP 35/2021) tidak ditampilkan di layar mana pun; beranda hanya memakai isi.faq dan isi.sedangDibuat.
  isi: [],
};

describe("catatan UU 27/2026 untuk teks kamus (Q-56)", () => {
  const bagian = new Set<string>();
  for (const k of [kamusId, kamusEn]) for (const [nama, isi] of Object.entries(k)) if (DASAR_TERDAMPAK.test(JSON.stringify(isi))) bagian.add(nama);

  it("setiap bagian kamus id dan en yang menyebut dasar terdampak sudah dipetakan ke layarnya", () => {
    expect([...bagian].filter((b) => !LAYAR_BAGIAN[b])).toEqual([]);
    expect(bagian.size).toBeGreaterThan(5);
  });

  it("setiap layar itu memasang CatatanUuBaru", () => {
    for (const b of bagian) for (const r of LAYAR_BAGIAN[b] ?? []) expect(readFileSync(join(SRC, r), "utf8"), `${b} -> ${r}`).toContain("CatatanUuBaru");
  });
});
