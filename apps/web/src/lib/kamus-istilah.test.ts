import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cariIstilah, ISTILAH } from "./kamus-istilah";

const APP = join(__dirname, "..", "app");
const ada = (href: string) => existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx"));

describe("kamus istilah", () => {
  it("minimal 40 istilah, slug unik, setiap tautan menuju halaman yang ada", () => {
    expect(ISTILAH.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ISTILAH.map((i) => i.slug)).size).toBe(ISTILAH.length);
    for (const i of ISTILAH) {
      expect(i.tautan.length, i.slug).toBeGreaterThan(0);
      for (const t of i.tautan) expect(ada(t.href), `${i.slug} -> ${t.href}`).toBe(true);
    }
  });
  it("tanpa tanda pisah panjang, kata terlarang, atau angka persen tarif", () => {
    const s = JSON.stringify(ISTILAH);
    expect(s).not.toMatch(/[\u2013\u2014]/);
    expect(s.toLowerCase()).not.toMatch(/silakan|revolusioner|inovatif/);
    expect(s).not.toMatch(/\d+(,\d+)?\s?%/);
  });
  it("cari menemukan istilah dari kata sehari-hari", () => {
    expect(cariIstilah("ptkp")[0]?.slug).toBe("ptkp");
    expect(cariIstilah("tagihan belum dibayar")[0]?.slug).toBe("piutang");
    expect(cariIstilah("karyawan kontrak").some((i) => i.slug === "pkwt")).toBe(true);
    expect(cariIstilah("qqqzz")).toEqual([]);
  });
});
