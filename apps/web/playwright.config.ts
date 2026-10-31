import { defineConfig, devices } from "@playwright/test";

// E2E lokal terhadap server produksi build (`next start`), atau terhadap URL luar lewat E2E_BASE_URL (mis. produksi Vercel).
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const PINDAH = ["topi.spec.ts", "gaji.spec.ts"];

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Makassar" },
  // Usaha aktif melekat di akun uji A (klaim JWT). Tes yang memindah usaha (@pindah, gaji, topi) dijalankan berantai
  // setelah proyek utama selesai, satu proyek per langkah, agar tidak mengubah usaha aktif tes lain yang sedang jalan (Q-10).
  projects: [
    { name: "hp", use: { ...devices["Pixel 7"] }, testIgnore: PINDAH, grepInvert: /@pindah/ },
    { name: "desktop", use: DESKTOP, testIgnore: PINDAH, grepInvert: /@pindah/ },
    { name: "pindah-topi", use: DESKTOP, testMatch: "topi.spec.ts", dependencies: ["hp", "desktop"] },
    { name: "pindah-gaji", use: DESKTOP, testMatch: "gaji.spec.ts", dependencies: ["pindah-topi"] },
    { name: "pindah-auth", use: DESKTOP, testMatch: "auth.spec.ts", grep: /@pindah/, dependencies: ["pindah-gaji"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start -p 3100", url: base, reuseExistingServer: true, timeout: 120_000, env: { NADI_CIMD_IZINKAN_LOKAL: "1" } },
});
