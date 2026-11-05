import { describe, expect, it } from "vitest";
import { SEMUA_HALAMAN } from "@/lib/ruang";

describe("ikon halaman (ANTI-SLOP S55)", () => {
  it("setiap halaman punya ikon, tidak ada ikon ganda, ikon halaman tidak sama dengan ikon ruang", async () => {
    const { IKON_HALAMAN, IKON_RUANG } = await import("./ikon-halaman");
    const tanpa = SEMUA_HALAMAN.filter((x) => !IKON_HALAMAN[x.href]).map((x) => x.href);
    expect(tanpa).toEqual([]);
    const ikon = Object.values(IKON_HALAMAN);
    expect(new Set(ikon).size).toBe(ikon.length);
    const ruang = new Set(Object.values(IKON_RUANG));
    expect(ikon.filter((i) => ruang.has(i))).toEqual([]);
  }, 60_000);
});
