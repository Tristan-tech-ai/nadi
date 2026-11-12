import { defineConfig, devices } from "@playwright/test";

// E2E lokal terhadap server produksi build (`next start`), atau terhadap URL luar lewat E2E_BASE_URL (mis. produksi Vercel).
const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const PINDAH = ["topi.spec.ts", "gaji.spec.ts", "kolam.spec.ts", "mulai.spec.ts"];

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // D-12: keputusan Feed dikirim setelah jendela Batalkan 4 dtk, jadi pesan hasil dari server butuh lebih dari 5 dtk bawaan.
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Makassar" },
  // Usaha aktif melekat di akun uji A (klaim JWT). Tes yang memindah usaha (@pindah, gaji, topi, kolam) dijalankan berantai
  // setelah proyek utama selesai, satu proyek per langkah, agar tidak mengubah usaha aktif tes lain yang sedang jalan (Q-10).
  projects: [
    { name: "hp", use: { ...devices["Pixel 7"] }, testIgnore: PINDAH, grepInvert: /@pindah|@bahasa-akun/ },
    { name: "desktop", use: DESKTOP, testIgnore: PINDAH, grepInvert: /@pindah|@bahasa-akun/ },
    { name: "pindah-topi", use: DESKTOP, testMatch: "topi.spec.ts", dependencies: ["hp", "desktop"] },
    { name: "pindah-gaji", use: DESKTOP, testMatch: "gaji.spec.ts", dependencies: ["pindah-topi"] },
    { name: "pindah-kolam", use: DESKTOP, testMatch: "kolam.spec.ts", dependencies: ["pindah-gaji"] },
    // mulai.spec memindah akun A ke usaha "Uji Mulai E2E"; bila paralel, akun staf dari auth.spec pernah tercipta di usaha itu (UAT-01).
    { name: "pindah-mulai", use: DESKTOP, testMatch: "mulai.spec.ts", dependencies: ["pindah-kolam"] },
    { name: "pindah-auth", use: DESKTOP, testMatch: "auth.spec.ts", grep: /@pindah/, dependencies: ["pindah-mulai"] },
    // Mengubah bahasa akun uji A: berjalan paling akhir agar spec lain yang membaca teks Indonesia tidak ikut berubah.
    { name: "bahasa-akun", use: DESKTOP, testMatch: "bahasa.spec.ts", grep: /@bahasa-akun/, dependencies: ["pindah-auth"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start -p 3100", url: base, reuseExistingServer: true, timeout: 120_000, env: { NADI_CIMD_IZINKAN_LOKAL: "1" } },
});
