import { expect, test } from "@playwright/test";

// KONTAK-01: alamat kontak resmi tampil sebagai tautan email di halaman privasi, keamanan, dan tentang (id dan en); tidak ada lagi
// kalimat "sedang disiapkan" untuk alamat kontak.
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
});

for (const jalur of ["/privasi", "/keamanan", "/tentang", "/en/privasi", "/en/keamanan", "/en/tentang"]) {
  test(`kontak resmi di ${jalur}`, async ({ page }) => {
    await page.goto(jalur);
    const tautan = page.locator('main a[href="mailto:nadiusaha.my.id@gmail.com"]');
    await expect(tautan.first()).toBeVisible();
    await expect(tautan.first()).toHaveText("nadiusaha.my.id@gmail.com");
    await expect(page.locator("main")).not.toContainText(/alamat (kontak )?resmi[^.]*sedang disiapkan|is being set up/i);
  });
}
