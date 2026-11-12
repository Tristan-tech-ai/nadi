import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { tangani, type Rpc } from "@/lib/mcp/protokol";
import { periksaSkill, zipSkill } from "./paket";
import { BERKAS_REFERENSI, kontenSkill, skillUmum, uriSkill, type BahasaSkill } from "./umum";

const MCP = "https://nadiusaha.my.id/api/mcp";
const BAHASA: BahasaSkill[] = ["id", "en"];
// Salinan berkas di docs/skill/{nadi,nadi-en} diperiksa gerbang tulisan (scripts/cek-tulisan.py). SKILL_TULIS=1 menulis ulang.
const DOCS = join(__dirname, "..", "..", "..", "..", "..", "docs", "skill");

const rpcPalsu: Rpc = async (fungsi) => {
  if (fungsi === "mcp_siapa_saya") return { peran: "staf", cakupan: ["nadi.baca"], usaha: { nama: "Warung Uji" } };
  throw new Error(`tidak diharapkan: ${fungsi}`);
};
const baca = (uri: string) =>
  tangani(new Headers(), { jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri } }, rpcPalsu, "nmc_uji", MCP);

describe("skill umum Nadi (W-05)", () => {
  for (const b of BAHASA) {
    it(`${b}: lolos format Agent Skills dan semua rincian ditautkan`, () => {
      const p = skillUmum(b, MCP);
      expect(periksaSkill(p.nama, p.berkas["SKILL.md"])).toEqual([]);
      for (const r of BERKAS_REFERENSI) {
        expect(p.berkas[r]?.length).toBeGreaterThan(200);
        expect(p.berkas["SKILL.md"]).toContain(`](${r})`);
      }
      expect(p.berkas["SKILL.md"]).toContain(MCP);
      // Tidak ada tanda pisah panjang, emoji, atau sapaan resmi.
      const semua = Object.values(p.berkas).join("\n");
      expect(semua).not.toMatch(/[–—]|\p{Extended_Pictographic}|\bAnda\b/u);
    });

    it(`${b}: MCP resources/read ${uriSkill(b)} sama persis dengan isi zip unduhan`, async () => {
      const zip = unzipSync(zipSkill(skillUmum(b, MCP)));
      const j = await baca(uriSkill(b));
      const isi = (j.body as { result: { contents: { uri: string; text: string; mimeType: string }[] } }).result.contents;
      expect(isi).toHaveLength(Object.keys(zip).length);
      for (const k of isi) {
        const jalur = k.uri === uriSkill(b) ? "SKILL.md" : k.uri.slice(uriSkill(b).length + 1);
        expect(k.mimeType).toBe("text/markdown");
        expect(k.text).toBe(strFromU8(zip[`nadi/${jalur}`]));
      }
      expect(kontenSkill(b, MCP).map((k) => k.text)).toEqual(isi.map((k) => k.text));
    });

    it(`${b}: salinan docs/skill sama dengan isi skill`, () => {
      const p = skillUmum(b, MCP);
      const folder = join(DOCS, b === "en" ? "nadi-en" : "nadi");
      for (const [jalur, teks] of Object.entries(p.berkas)) {
        const f = join(folder, jalur);
        if (process.env.SKILL_TULIS === "1") {
          mkdirSync(dirname(f), { recursive: true });
          writeFileSync(f, teks);
        }
        expect(existsSync(f), f).toBe(true);
        expect(readFileSync(f, "utf8")).toBe(teks);
      }
    });
  }

  it("resources/list menyebut skill untuk semua peran, sebagai markdown", async () => {
    const j = await tangani(new Headers(), { jsonrpc: "2.0", id: 2, method: "resources/list", params: {} }, rpcPalsu, "nmc_uji", MCP);
    const daftar = (j.body as { result: { resources: { uri: string; mimeType: string }[] } }).result.resources;
    expect(daftar.filter((x) => x.uri.startsWith("nadi://skill")).map((x) => [x.uri, x.mimeType])).toEqual([
      ["nadi://skill", "text/markdown"],
      ["nadi://skill/en", "text/markdown"],
    ]);
  });

  it("initialize menyebut nadi://skill di instructions", async () => {
    const j = await tangani(new Headers(), { jsonrpc: "2.0", id: 3, method: "initialize", params: { protocolVersion: "2025-06-18" } }, rpcPalsu, "nmc_uji", MCP);
    expect((j.body as { result: { instructions: string } }).result.instructions).toContain("nadi://skill");
  });
});
