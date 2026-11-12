import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// U-07: Masuk dengan Google di /masuk dan /daftar. Bila penyedia Google belum dinyalakan di Supabase, halaman berkata jujur;
// bila sudah, tombol resmi Google (GIS) menukar kartu ID lewat signInWithIdToken dengan nonce; Google sendiri tidak dibuka di tes.
test("masuk dengan Google: tombol atau penjelasan jujur, rute balik aman", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali");
  for (const [jalur, lebar] of [["/masuk?next=/app/gaji", 390], ["/daftar", 1440]] as const) {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto(jalur);
    const blok = page.getByTestId("masuk-google");
    await expect(blok).toBeVisible();
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400); // transisi warna tombol (<= 300 ms) selesai dulu
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} ${n.failureSummary?.split(String.fromCharCode(10))[1] ?? ""}`).join(" | ")}`), `${jalur} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`google-${lebar}-${skema}.png`) });
    }
    await page.emulateMedia({ colorScheme: "light" });
    if ((await blok.getAttribute("data-aktif")) === "tidak") {
      await expect(blok).toContainText("belum dinyalakan");
      await expect(blok.getByRole("button")).toHaveCount(0);
    } else {
      // AUTH-GIS: tombol resmi Google. Skrip Google diganti tiruan yang mencatat opsi initialize, menggambar tombol, dan
      // mengembalikan kartu ID palsu; Supabase harus menolaknya dan halaman menampilkan pesan, tanpa pengalihan ke supabase.co.
      await page.route("https://accounts.google.com/gsi/client", (r) => r.fulfill({ contentType: "text/javascript", body: `
        window.google = { accounts: { id: {
          initialize(o) { window.__gis = o; },
          renderButton(el, o) { window.__gisTombol = o; const b = document.createElement("button"); b.type = "button";
            b.textContent = "Tombol Google tiruan"; b.onclick = () => window.__gis.callback({ credential: "palsu.palsu.palsu" }); el.appendChild(b); },
        } } };` }));
      await page.reload();
      const tombol = page.getByTestId("tombol-google-resmi");
      await expect(tombol).toHaveAttribute("data-keadaan", "siap");
      const opsi = await page.evaluate(() => (window as unknown as { __gis: { client_id: string; nonce: string; use_fedcm_for_button: boolean } }).__gis);
      expect(opsi.client_id).toMatch(/\.apps\.googleusercontent\.com$/);
      expect(opsi.nonce).toMatch(/^[0-9a-f]{64}$/);
      expect(opsi.use_fedcm_for_button).toBe(true);
      let keSupabaseAuthorize = false;
      page.on("request", (r) => { if (r.url().includes("/auth/v1/authorize")) keSupabaseAuthorize = true; });
      const [tukar] = await Promise.all([
        page.waitForRequest((r) => r.url().includes("/auth/v1/token") && r.url().includes("id_token")),
        tombol.getByRole("button", { name: "Tombol Google tiruan" }).click(),
      ]);
      expect(tukar.postDataJSON()).toMatchObject({ provider: "google", id_token: "palsu.palsu.palsu" });
      expect((tukar.postDataJSON() as { nonce?: string }).nonce).not.toBe(opsi.nonce);
      await expect(tombol.getByRole("alert")).toBeVisible();
      expect(keSupabaseAuthorize).toBe(false);
    }
  }
  // Rute balik: kode palsu tidak memberi sesi dan kembali ke /masuk dengan pesan.
  await page.goto("/auth/konfirmasi?code=palsu&next=/app/gaji");
  await page.waitForURL((u) => u.pathname === "/masuk" && u.searchParams.get("galat") === "tautan");
  // Tujuan luar ditolak jalurAman.
  await page.goto("/auth/konfirmasi?code=palsu&next=//contoh.invalid");
  await page.waitForURL((u) => u.pathname === "/masuk");
});
