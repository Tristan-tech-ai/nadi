import { describe, expect, it } from "vitest";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { kamusId } from "@/lib/i18n/kamus/id";
import { ALAT, SUMBER } from "./protokol";
import { petunjukApp, promptSambung } from "./prompt-sambung";

const ALAMAT = "https://nadi-swart.vercel.app/api/mcp";
const ASAL = "https://nadi-swart.vercel.app";
const app = (t: typeof kamusId.siapkan) => petunjukApp(t);

describe("prompt lengkap sambungan MCP", () => {
  for (const bahasa of ["id", "en"] as const) {
    const p = promptSambung({ alamat: ALAMAT, asal: ASAL, app: app(bahasa === "en" ? kamusEn.siapkan : kamusId.siapkan), bahasa });
    it(`${bahasa}: memuat alamat server, halaman draf, dan petunjuk semua aplikasi`, () => {
      expect(p).toContain(ALAMAT);
      expect(p).toContain(`${ASAL}/app/siapkan/draf`);
      for (const a of app(bahasa === "en" ? kamusEn.siapkan : kamusId.siapkan)) expect(p).toContain(a.ket);
    });
    it(`${bahasa}: setiap alat dan sumber yang disebut benar-benar ada di server MCP`, () => {
      const alat = new Set(ALAT.map((a) => a.name));
      for (const nama of p.match(/\b[a-z]+_[a-z_]+\b/g) ?? []) expect(alat.has(nama), nama).toBe(true);
      for (const uri of p.match(/nadi:\/\/[a-z/]+/g) ?? []) expect(SUMBER.some((s) => s.uri === uri), uri).toBe(true);
      for (const wajib of ["siapa_saya", "tulis_draf", "baca_draf", "ubah_draf"]) expect(p).toContain(wajib);
      expect(p).not.toMatch(/di bawah membuka|below opens/);
    });
    it(`${bahasa}: batasan uang, gaji, NIK, dan kata sandi tertulis`, () => {
      expect(p).toMatch(bahasa === "en" ? /move money/ : /memindahkan uang/);
      expect(p).toMatch(/NIK/);
      expect(p).toMatch(bahasa === "en" ? /never ticked automatically/ : /tidak pernah tercentang otomatis/);
      expect(p).toMatch(bahasa === "en" ? /Nadi password/ : /kata sandi Nadi/);
      expect(p).not.toMatch(/[\u2013\u2014]/);
    });
  }
  it("petunjuk aplikasi tersedia di kedua kamus", () => {
    for (const t of [kamusId.siapkan, kamusEn.siapkan]) for (const k of ["app1Ket", "app2Prompt", "app3Ket", "app4Ket", "salinPromptLengkap"] as const) expect(t[k].length, k).toBeGreaterThan(5);
  });
});
