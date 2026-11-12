import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { periksaSkill } from "../src/lib/skill/paket";

// F6-05: pemilik mengunduh paket skill dari halaman Usaha; zip berisi satu folder Agent Skills yang sah (name = folder),
// alamat MCP situs ini, rincian usaha, dan tanpa angka panjang mirip NIK/rekening. Folder diekstrak ke E2E_SKILL_DIR bila diisi
// (untuk validator resmi skills-ref).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

test("paket skill: unduh dari halaman Usaha, zip Agent Skills sah tanpa data pribadi", async ({ page }) => {
  await page.goto("/masuk?next=/app/perusahaan");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/perusahaan");
  const tunggu = page.waitForEvent("download");
  await page.getByTestId("unduh-skill").click();
  const unduhan = await tunggu;
  expect(unduhan.suggestedFilename()).toMatch(/^nadi-[a-z0-9-]+\.zip$/);
  const isi = unzipSync(new Uint8Array(readFileSync(await unduhan.path())));
  const folder = unduhan.suggestedFilename().replace(/\.zip$/, "");
  expect(Object.keys(isi).sort()).toEqual([`${folder}/SKILL.md`, `${folder}/references/usaha.md`]);
  const skill = strFromU8(isi[`${folder}/SKILL.md`]);
  const usaha = strFromU8(isi[`${folder}/references/usaha.md`]);
  expect(periksaSkill(folder, skill)).toEqual([]);
  expect(skill).toContain(`${new URL(page.url()).origin}/api/mcp`);
  expect(skill).toContain("buat_usulan");
  expect(usaha).toContain("## Topi");
  // Nama topi buatan tes lain memuat Date.now() (13 digit, mis. "Barista Ilmu 1793754778763"); itu bukan data pribadi.
  expect((skill + usaha).replace(/\b1[789]\d{11}\b/g, "")).not.toMatch(/\b\d{12,}\b/);
  if (process.env.E2E_SKILL_DIR) {
    for (const [jalur, data] of Object.entries(isi)) {
      const tujuan = join(process.env.E2E_SKILL_DIR, jalur);
      mkdirSync(dirname(tujuan), { recursive: true });
      writeFileSync(tujuan, data);
    }
  }
});
