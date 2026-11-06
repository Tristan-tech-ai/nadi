import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { panelMenu } from "./nav-publik";

const APP = join(__dirname, "..", "app");
const ada = (href: string) => {
  const [jalur, jangkar] = href.split("#");
  const bagian = jalur.split("/").filter(Boolean);
  const berkas = existsSync(join(APP, ...bagian, "page.tsx")) || (bagian.length >= 2 && existsSync(join(APP, ...bagian.slice(0, -1), "[slug]", "page.tsx")))
    || (bagian[0] === "bantuan" && bagian[1] === "artikel");
  const jangkarOk = !jangkar || kamusId.panduanHalaman.peran.some((p) => p.id === jangkar);
  return berkas && jangkarOk;
};

describe("navigasi halaman depan", () => {
  for (const [bahasa, awal] of [["id", ""], ["en", "/en"]] as const) {
    it(`${bahasa}: dua panel, setiap kelompok berisi, setiap tautan menuju halaman yang ada`, () => {
      const p = panelMenu(bahasa, awal);
      expect(p.map((x) => x.id)).toEqual(["solusi", "sumber"]);
      for (const x of p) for (const k of x.kelompok) {
        expect(k.butir.length, k.judul).toBeGreaterThan(0);
        for (const b of [...k.butir, ...(k.semua ? [k.semua] : [])]) expect(ada(b.href), `${bahasa} ${b.href}`).toBe(true);
      }
      expect(JSON.stringify(p)).not.toMatch(/[–—]/);
    });
  }
});
