import { defineConfig, devices } from "@playwright/test";

// E2E lokal terhadap server produksi build (`next start`), atau terhadap URL luar lewat E2E_BASE_URL (mis. produksi Vercel).
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Makassar" },
  projects: [
    { name: "hp", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start -p 3100", url: base, reuseExistingServer: true, timeout: 120_000, env: { NADI_CIMD_IZINKAN_LOKAL: "1" } },
});
