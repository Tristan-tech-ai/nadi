import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DENAH } from "../src/lib/mata/toko-sintetis";

// W-10A: CCTV lewat jembatan go2rtc. "Kamera" = go2rtc kedua yang menyiarkan video korpus mata-v2/pendek.webm (5 pelanggan berjalur
// diketahui) sebagai RTSP di 127.0.0.1:18554 lewat ffmpeg, bingkai terakhir (toko kosong) diulang seperti kamera yang terus menyala.
// Pemilik (akun A) mengisi alamat RTSP itu di layar Mata, menyimpan go2rtc.yaml dari layar, jembatan dijalankan PERSIS dengan berkas
// itu, lalu Mata membuka WebRTC dari 127.0.0.1:1984 dan menghitung di peramban. Tidak ada video ke server Nadi: setiap permintaan
// ke luar 127.0.0.1 diperiksa ukurannya. Butuh GO2RTC_BIN (go2rtc v1.9.15, MIT) dan ffmpeg di PATH.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const GO2RTC = process.env.GO2RTC_BIN ?? E.GO2RTC_BIN;
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata-v2");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL || !GO2RTC, "sekali (desktop), butuh .env.local, .env.e2e.local, GO2RTC_BIN");
});

test("Mata: CCTV RTSP lewat jembatan go2rtc dihitung di peramban", async ({ browser, baseURL }) => {
  test.setTimeout(420_000);
  const benar = (JSON.parse(readFileSync(join(KORPUS, "pendek.json"), "utf8")) as { jawaban: unknown[] }).jawaban.length;
  const proses: ChildProcess[] = [];
  const jalankan = (dir: string) => {
    const p = spawn(GO2RTC!, ["-c", "go2rtc.yaml"], { cwd: dir, stdio: "ignore" });
    proses.push(p);
  };
  try {
    // Kamera sintetis: RTSP H.264 dari video korpus, mulai saat jembatan pertama kali membaca.
    const dirKamera = mkdtempSync(join(tmpdir(), "nadi-kamera-"));
    const video = join(KORPUS, "pendek.webm").replace(/\\/g, "/");
    writeFileSync(join(dirKamera, "go2rtc.yaml"), [
      "app:", "  modules: [rtsp, exec]", "api:", '  listen: ""', "rtsp:", '  listen: "127.0.0.1:18554"', "webrtc:", '  listen: ""', "streams:",
      `  sumber: exec:ffmpeg -hide_banner -loglevel error -re -i ${video} -vf tpad=stop_mode=clone:stop_duration=600 -c:v libx264 -preset veryfast -tune zerolatency -g 10 -an -rtsp_transport tcp -f rtsp {output}`,
      "",
    ].join("\n"));
    jalankan(dirKamera);

    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
    expect((await sb.rpc("save_vision_zones", { p_zones: DENAH.zona.map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon })) })).error).toBeNull();
    expect((await sb.rpc("set_vision_notice", { p_on: true })).error).toBeNull();

    // Chrome 142+: halaman publik yang membuka 127.0.0.1 butuh izin Local Network Access dari pemilik (di sini diberikan untuk uji).
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, locale: "id-ID", acceptDownloads: true, permissions: ["local-network-access"] });
    const page = await ctx.newPage();
    const keluar: { url: string; ukuran: number }[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.hostname !== "127.0.0.1") keluar.push({ url: `${u.host}${u.pathname}`, ukuran: r.postDataBuffer()?.length ?? 0 });
    });

    await page.goto("/masuk?next=/app/mata");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/mata");
    await page.waitForLoadState("networkidle");

    const j = page.getByTestId("jembatan");
    await j.locator("summary").click();
    // Isian salah ditolak di peramban sebelum berkas dibuat.
    await j.getByTestId("jembatan-merek").selectOption("hikvision");
    await j.getByTestId("jembatan-alamat-kamera").fill("8.8.8.8");
    await j.getByTestId("jembatan-unduh").click();
    await expect(j.getByRole("alert")).toContainText("jaringan toko");
    await j.getByTestId("jembatan-merek").selectOption("lengkap");
    await j.getByTestId("jembatan-alamat-kamera").fill("rtsp://127.0.0.1:18554/sumber");
    const unduh = page.waitForEvent("download");
    await j.getByTestId("jembatan-unduh").click();
    const berkas = await unduh;
    expect(berkas.suggestedFilename()).toBe("go2rtc.yaml");
    const dirJembatan = mkdtempSync(join(tmpdir(), "nadi-jembatan-"));
    await berkas.saveAs(join(dirJembatan, "go2rtc.yaml"));
    const isi = readFileSync(join(dirJembatan, "go2rtc.yaml"), "utf8");
    expect(isi).toContain('mata: "rtsp://127.0.0.1:18554/sumber"');
    expect(isi).not.toMatch(/exec|echo/);
    jalankan(dirJembatan);
    await page.waitForTimeout(1500);

    const axe = await new AxeBuilder({ page }).include('[data-testid="hitung-kunjungan"]').analyze();
    expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id)).toEqual([]);

    const panel = page.getByTestId("hitung-kunjungan");
    await j.getByTestId("jembatan-mulai").click();
    await expect(panel.getByTestId("kunjungan-layar")).toBeVisible({ timeout: 20_000 });
    // Rekaman 79 dtk; tunggu kelima pelanggan selesai, lalu beberapa detik toko kosong (hitungan tidak boleh naik lagi).
    await expect.poll(async () => Number((await panel.getByTestId("kunjungan-hasil").getAttribute("data-kunjungan").catch(() => "0")) ?? 0), { timeout: 150_000, intervals: [2000] }).toBeGreaterThanOrEqual(benar - 0);
    await page.waitForTimeout(10_000);
    await panel.getByRole("button", { name: "Berhenti dan kirim" }).click();
    await expect(panel.getByTestId("kunjungan-terkirim")).toBeVisible({ timeout: 30_000 });
    const n = Number(await panel.getByTestId("kunjungan-hasil").getAttribute("data-kunjungan"));
    const pintu = panel.getByTestId("kunjungan-pintu");
    console.log(`MATA_JEMBATAN kunjungan ${n}/${benar}, pintu masuk ${await pintu.getAttribute("data-masuk")} keluar ${await pintu.getAttribute("data-keluar")}`);
    expect(Math.abs(n - benar) / benar).toBeLessThanOrEqual(0.1);

    // Tidak ada video yang dikirim ke Nadi: permintaan ke luar komputer ini hanya halaman, aksi server, dan rekap kecil.
    const besar = keluar.filter((k) => k.ukuran > 50_000);
    console.log(`MATA_JEMBATAN permintaan keluar ${keluar.length}, terbesar ${Math.max(0, ...keluar.map((k) => k.ukuran))} bita`);
    expect(besar).toEqual([]);
    expect(keluar.filter((k) => k.url.includes("/api/webrtc"))).toEqual([]);

    for (const [w, h] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(200);
        const a = await new AxeBuilder({ page }).include('[data-testid="hitung-kunjungan"]').analyze();
        expect(a.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), `${w} ${skema}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await j.screenshot({ path: test.info().outputPath(`jembatan-${w}-${skema}.png`) });
      }
    }
    await ctx.close();
  } finally {
    for (const p of proses) p.kill();
  }
});
