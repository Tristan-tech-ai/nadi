import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("beranda tampil, berbahasa Indonesia, tanpa pelanggaran aksesibilitas serius", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(2600); // nota demo selesai tercetak; axe membaca kontras saat masih memudar
  const hasil = await new AxeBuilder({ page }).analyze();
  const serius = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serius.map((v) => v.id)).toEqual([]);
});

test("area aplikasi mengalihkan tamu ke halaman masuk", async ({ page }) => {
  const res = await page.goto("/app");
  expect(page.url()).toContain("/masuk?next=%2Fapp");
  expect(res).not.toBeNull();
});

for (const jalur of ["/masuk", "/daftar"]) {
  test(`halaman ${jalur} tanpa pelanggaran aksesibilitas serius`, async ({ page }, info) => {
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hasil = await new AxeBuilder({ page }).analyze();
    expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${jalur.slice(1)}-${info.project.name}.png`) });
  });
}

test("landing: demo nota bisa disetujui, axe bersih di 390 dan 1440 px terang dan gelap", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar diatur sendiri");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await expect(page.getByRole("link", { name: "Mulai dari satu nota" })).toHaveAttribute("href", "/daftar");
  // Kartu di HP pengait juga <article> (komponen aplikasi asli), jadi demo dibatasi ke meja Coba sendiri.
  const demo = page.locator(".meja-coba article", { hasText: "Catat belanja" });
  // W-01: jangkauan, bukan satu nota: >= 8 jenis berkas di pengait, >= 6 jenis usaha di pita, 5 berkas Coba sendiri.
  const jenis = await page.locator(".pengait-meja [data-jenis]").evaluateAll((el) => [...new Set(el.map((e) => e.getAttribute("data-jenis")))]);
  expect(jenis.length, jenis.join(",")).toBeGreaterThanOrEqual(8);
  const usaha = await page.locator("[data-testid=pita-usaha] [data-usaha]").evaluateAll((el) => [...new Set(el.map((e) => e.getAttribute("data-usaha")))]);
  expect(usaha.length).toBeGreaterThanOrEqual(6);
  await expect(page.locator(".pilih-berkas button")).toHaveCount(5);
  await expect(page.locator(".pengait .layar-app article")).toHaveCount(3);
  await page.locator(".pilih-berkas button", { hasText: "Mutasi bank" }).click();
  await expect(page.locator(".meja-coba article")).toContainText("Rp1.240.000");
  await page.locator(".pilih-berkas button", { hasText: "Nota pemasok" }).click();
  // ANTI-SLOP S12: judul tampilan paling banyak 3 baris di 390 px.
  await page.setViewportSize({ width: 390, height: 844 });
  const h1 = page.getByRole("heading", { level: 1 });
  const baris = await h1.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(baris).toBeLessThanOrEqual(3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await demo.getByRole("button", { name: "Setujui" }).click();
  await expect(demo).toContainText("Tercatat sebagai belanja 13 Okt 2026.");
  await demo.getByRole("button", { name: "Ulangi" }).click();
  await expect(page.locator(".meja-coba article", { hasText: "Catat belanja" }).getByRole("button", { name: "Tolak" })).toBeVisible();
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(2600); // nota selesai tercetak dan transisi warna selesai
      const hasil = await new AxeBuilder({ page }).analyze();
      expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`landing-${lebar}-${skema}.png`), fullPage: true });
    }
  }
});

test("landing lengkap: menu Fitur, sembilan halaman fitur, harga, FAQ, tanpa status basi", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // Menu Fitur (popover bawaan): 9 pintu bergambar, setiap pintu ke halaman fiturnya.
  const nav = page.getByRole("navigation", { name: "Utama" });
  await nav.getByRole("button", { name: "Fitur" }).click();
  const menu = page.locator("#menu-fitur");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".kisi-fitur a")).toHaveCount(9);
  await menu.getByRole("link", { name: /^Gaji/ }).click();
  await expect(page).toHaveURL(/\/fitur\/gaji$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gaji beres");
  await expect(page.getByRole("link", { name: /Fitur berikutnya: Tagihan/ })).toHaveAttribute("href", "/fitur/tagihan");
  await page.goto("/");
  await expect(page.locator("#fitur .pintu a")).toHaveCount(9);
  const harga = page.locator("#harga li");
  await expect(harga).toHaveCount(4);
  await expect(harga.nth(1)).toContainText("Rp149.000");
  await expect(page.locator("#harga")).toContainText("belum ada tagihan");
  const faq = page.locator("#faq details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");
  // Fitur yang sudah jalan tidak boleh tertulis "sedang dibuat" (temuan riset landing 3 Nov 2026).
  const sedang = await page.locator("#faq ul").innerText();
  expect(sedang).not.toMatch(/absen|gaji|topi|izin|invoice/i);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Panduan per peran" })).toHaveAttribute("href", "/panduan");
});

test("halaman fitur: sembilan jalur id dan en, axe bersih, judul paling banyak dua baris di 390 px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  test.setTimeout(240_000);
  const slug = ["lempar", "feed", "absen", "gaji", "tagihan", "jadwal", "mata", "rekrut", "pajak"];
  for (const s of slug) {
    for (const awal of ["", "/en"]) {
      await page.setViewportSize({ width: 390, height: 844 });
      const res = await page.goto(`${awal}/fitur/${s}`);
      expect(res?.status(), `${awal}/fitur/${s}`).toBe(200);
      const h1 = page.getByRole("heading", { level: 1 });
      const baris = await h1.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
      expect(baris, `${awal}/fitur/${s}`).toBeLessThanOrEqual(2);
      // W-01: baris "Dipakai untuk" berisi 4 sampai 6 kasus.
      const kasus = await page.getByTestId("dipakai").locator("li").count();
      expect(kasus, `${awal}/fitur/${s} dipakai`).toBeGreaterThanOrEqual(4);
      expect(kasus, `${awal}/fitur/${s} dipakai`).toBeLessThanOrEqual(6);
      if (s === "lempar" || s === "mata") {
        for (const skema of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: skema });
          await page.waitForTimeout(300);
          const hasil = await new AxeBuilder({ page }).analyze();
          expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${awal}/fitur/${s} ${skema}`).toEqual([]);
          await page.screenshot({ path: info.outputPath(`fitur-${s}${awal.replace("/", "-")}-390-${skema}.png`), fullPage: true });
        }
      }
    }
  }
});

test("halaman pendukung: harga, keamanan, privasi, syarat, tentang tertaut dan bersih axe", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Utama" }).getByRole("link", { name: "Harga" }).click();
  await expect(page).toHaveURL(/\/harga$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harga");
  await expect(page.getByRole("table")).toContainText("Rp174.000"); // Usaha 20 orang: 149.000 + 5 x 5.000
  const halaman: [string, string, string][] = [
    ["Harga", "/harga", "Harga"], ["Keamanan data", "/keamanan", "Keamanan data"], ["Kebijakan privasi", "/privasi", "Kebijakan privasi"],
    ["Syarat layanan", "/syarat", "Syarat layanan"], ["Tentang Nadi", "/tentang", "Tentang Nadi"],
  ];
  for (const [tautan, jalur, judul] of halaman) {
    await page.getByRole("contentinfo").getByRole("link", { name: tautan }).click();
    await expect(page).toHaveURL(new RegExp(`${jalur}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    for (const skema of ["light", "dark"] as const) {
      for (const [w, h] of [[390, 844], [1440, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(200);
        const r = await new AxeBuilder({ page }).analyze();
        expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${jalur} ${w} ${skema}`).toEqual([]);
      }
    }
  }
  await expect(page.locator("[role=note]").filter({ visible: true })).toHaveCount(0); // tentang tanpa tanda draf (halaman sebelumnya tersimpan tersembunyi)
  await page.goto("/privasi");
  await expect(page.getByRole("note")).toContainText("belum ditinjau ahli hukum");
});

test("coba usaha contoh dari landing: Feed demo tampil < 3 dtk, baca-saja, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar diatur sendiri");
  await page.goto("/");
  const mulai = Date.now();
  await page.getByRole("link", { name: "Coba usaha contoh", exact: true }).first().click();
  // Cache Components menyimpan halaman sebelumnya (tersembunyi) saat pindah rute, jadi batasi ke Feed yang terlihat.
  const feed = page.getByTestId("feed-demo").filter({ visible: true });
  await expect(feed.locator("article")).toHaveCount(4);
  expect(Date.now() - mulai).toBeLessThan(3000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Warung Makan Bu Ratna (contoh)");
  const kartu = feed.locator("article", { hasText: "Catat izin sakit Komang Ayu" });
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await expect(kartu.getByTestId("hasil-demo")).toContainText("tidak disimpan");
  await page.getByRole("link", { name: "Toko grosir" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toko Grosir Sinar Jaya (contoh)");
  await expect(feed.locator("article")).toHaveCount(3);
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const hasil = await new AxeBuilder({ page }).analyze();
      expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`demo-${lebar}-${skema}.png`), fullPage: true });
    }
  }
});
