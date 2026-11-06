import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEMUA_ARTIKEL } from "./bantuan/artikel";
import { RILIS } from "./rilis";

const APP = join(__dirname, "..", "app");
const ada = (href: string) => {
  const m = href.match(/^\/bantuan\/artikel\/(.+)$/);
  if (m) return SEMUA_ARTIKEL.some((a) => a.slug === m[1]);
  return existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx"));
};

describe("catatan rilis", () => {
  it("setiap butir bertanggal sah, tidak di masa depan, dan tautannya ada", () => {
    for (const x of RILIS) {
      expect(x.tanggal, x.judul).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.tanggal <= new Date().toISOString().slice(0, 10), x.judul).toBe(true);
      expect(ada(x.tautan.href), `${x.judul} -> ${x.tautan.href}`).toBe(true);
    }
  });
  it("tanpa tanda pisah panjang", () => expect(JSON.stringify(RILIS)).not.toMatch(/[\u2013\u2014]/));
});
