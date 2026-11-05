import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AKSI_DIKENAL, tujuanUsulan } from "./tujuan-usulan";
import { SEMUA_HALAMAN } from "./ruang";

// Aksi usulan yang ditulis migrasi (insert ke public.usulan dengan literal aksi 'x.y') harus punya keterangan tujuan sendiri.
const MIGRASI = join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
function aksiDiMigrasi(): string[] {
  const hasil = new Set<string>();
  for (const f of readdirSync(MIGRASI)) {
    const s = readFileSync(join(MIGRASI, f), "utf8");
    for (const m of s.matchAll(/insert into public\.usulan[^;]*?values\s*\([^;]*?'([a-z_]+\.[a-z_]+)'/gi)) hasil.add(m[1]);
    for (const m of s.matchAll(/aksi\s*=\s*'([a-z_]+\.[a-z_]+)'/g)) hasil.add(m[1]);
  }
  return [...hasil].filter((a) => !/^(mata|absen\.harian|kas)\./.test(a) || a === "absen.impor");
}

describe("tujuan usulan (U-10)", () => {
  it("setiap aksi usulan dari migrasi punya keterangan tujuan sendiri", () => {
    const semua = aksiDiMigrasi();
    expect(semua.length).toBeGreaterThan(20); // pemindai benar-benar menemukan aksi
    const kurang = semua.filter((a) => !AKSI_DIKENAL.includes(a) && !a.startsWith("dokumen."));
    expect(kurang).toEqual([]);
  });
  it("setiap tujuan menunjuk halaman yang ada di peta ruang, dua bahasa", () => {
    const ada = new Set(SEMUA_HALAMAN.map((x) => x.href));
    for (const a of AKSI_DIKENAL) {
      for (const b of ["id", "en"] as const) {
        const t = tujuanUsulan(a, b);
        expect(ada.has(t.href), `${a} ${t.href}`).toBe(true);
        expect(t.akibat.length, a).toBeGreaterThan(10);
      }
    }
  });
  it("berkas yang tidak dikenali berkata jujur bahwa tidak ada data lain yang berubah", () => {
    expect(tujuanUsulan("berkas.tinjau").akibat).toContain("tidak ada data lain yang berubah");
    expect(tujuanUsulan("aksi.asing").href).toBe("/app");
  });
});
