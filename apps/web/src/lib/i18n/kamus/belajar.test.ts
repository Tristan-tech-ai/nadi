import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ambilKamus } from "./index";

// Q-51: pesan belajar format harus sesuai perilaku aturan bayangan di fungsi baca-berkas, pelajari-pindah, dan pelajari-tanya:
// format baru dibaca AI, lalu harus cocok BAYANGAN_WAJIB (2) kali lagi sebelum aturan dipakai tanpa AI. Rekaman 12 Nov 2026:
// unggahan pindah 1 sampai 3 berkolom sama masih "sedang mempelajari", baru unggahan 4 dibaca tanpa AI.
const FUNGSI = join(__dirname, "..", "..", "..", "..", "..", "..", "supabase", "functions");
const wajib = (berkas: string) => Number(/BAYANGAN_WAJIB = (\d+)/.exec(readFileSync(join(FUNGSI, berkas), "utf8"))?.[1]);

describe("pesan belajar format sesuai aturan bayangan", () => {
  it("ketiga fungsi memakai dua kecocokan lagi", () => {
    expect(wajib(join("baca-berkas", "pengawas.ts"))).toBe(2);
    expect(wajib(join("pelajari-tanya", "pengawas.ts"))).toBe(2);
    expect(wajib(join("pelajari-pindah", "index.ts"))).toBe(2);
  });

  for (const bahasa of ["id", "en"] as const) {
    it(`${bahasa}: tidak menjanjikan sekali saja, menyebut dua kecocokan lagi`, () => {
      const k = ambilKamus(bahasa);
      const pesan = [k.pindahPesan.belajar, k.tanya.belajar, k.klaim.belajarStruk];
      for (const p of pesan) {
        expect(p).not.toMatch(/sekali saja|just once/i);
        expect(p).toMatch(bahasa === "id" ? /\bdua\b/ : /\btwo\b/);
      }
    });
  }
});
