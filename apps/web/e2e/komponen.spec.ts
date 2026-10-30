import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Lembar komponen di tema terang dan gelap: tanpa pelanggaran aksesibilitas serius, tangkapan layar untuk tinjauan ANTI-SLOP.
for (const tema of ["light", "dark"] as const) {
  test(`lembar komponen (${tema})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await page.goto("/dev/komponen");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Rp1.847.500").or(page.getByText("Rp1,85 jt")).first()).toBeVisible();
    const hasil = await new AxeBuilder({ page }).analyze();
    const serius = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serius.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    await page.screenshot({ path: info.outputPath(`komponen-${info.project.name}-${tema}.png`), fullPage: true });
  });
}
