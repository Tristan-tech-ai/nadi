// Foto halaman di 390 dan 1440 px, terang dan gelap, plus hitungan pelanggaran axe serius/kritis.
// pakai: node scripts/foto-halaman.mjs <asal> <dir-keluar> /jalur1 /jalur2 ...
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

const [asal, keluar, ...jalur] = process.argv.slice(2);
mkdirSync(keluar, { recursive: true });
const b = await chromium.launch();
let gagal = 0;
for (const j of jalur) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"]) {
      const k = await b.newContext({ viewport: { width: lebar, height: tinggi }, colorScheme: skema, deviceScaleFactor: 1 });
      const p = await k.newPage();
      await p.goto(asal + j, { waitUntil: "networkidle" });
      await p.waitForTimeout(300);
      const nama = `${j.replace(/\W+/g, "_") || "_akar"}-${lebar}-${skema}`;
      await p.screenshot({ path: `${keluar}/${nama}.png`, fullPage: false });
      const r = await new AxeBuilder({ page: p }).analyze();
      const serius = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      if (serius.length) gagal++;
      console.log(nama, "axe serius:", serius.length, serius.map((v) => v.id).join(","));
      await k.close();
    }
  }
}
await b.close();
process.exit(gagal ? 1 : 0);
