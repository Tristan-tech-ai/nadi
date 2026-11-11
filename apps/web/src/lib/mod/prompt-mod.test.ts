import { describe, expect, it } from "vitest";
import { ALAT } from "@/lib/mcp/protokol";
import { ALAT_MOD, promptMod } from "./prompt-mod";

// X-20: prompt yang disalin pemilik untuk AI-nya hanya boleh menyebut alat MCP yang benar-benar ada, dan tidak menjanjikan
// kemampuan menerapkan fitur (AI hanya menulis draf).
describe("prompt fitur untuk AI pengguna", () => {
  const nama = new Set(ALAT.map((a) => a.name));
  const teks = promptMod({ alamat: "https://nadi.contoh.test/api/mcp", asal: "https://nadi.contoh.test" });
  it("setiap alat mod yang disebut ada di server MCP", () => {
    for (const a of ALAT_MOD) expect(nama.has(a), a).toBe(true);
    const disebut = [...new Set(teks.match(/\bmod_[a-z_]+\b/g) ?? [])];
    expect(disebut.length).toBeGreaterThanOrEqual(5);
    for (const a of disebut) expect(nama.has(a), `prompt menyebut ${a}`).toBe(true);
  });
  it("tidak ada alat untuk menerapkan, mematikan, atau mengembalikan versi", () => {
    expect([...nama].filter((n) => /^mod_(terapkan|atur|matikan|rollback|arsip)/.test(n))).toEqual([]);
    expect(teks).not.toMatch(/\bmod_(terapkan|atur|matikan|rollback)\b/);
    expect(teks).toContain("https://nadi.contoh.test/api/mcp");
  });
});
