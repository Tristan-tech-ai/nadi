import { expect, test } from "@playwright/test";

// Q-01: header keamanan dasar di halaman publik, halaman izin OAuth, dan halaman token (slip, tablet absen).
// Halaman tidak boleh dimuat dalam iframe situs lain (clickjacking tombol Izinkan atau Setujui).
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
});

for (const jalur of ["/", "/masuk", "/oauth/izinkan", "/slip", "/kios/tablet", "/lamar/AAAAAAAA"]) {
  test(`header keamanan ${jalur}`, async ({ request }) => {
    const r = await request.get(jalur, { maxRedirects: 0 });
    const h = r.headers();
    expect(h["x-frame-options"], jalur).toBe("DENY");
    expect(h["content-security-policy"], jalur).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"], jalur).toBe("nosniff");
    expect(h["referrer-policy"], jalur).toBe("strict-origin-when-cross-origin");
    // Mikrofon hanya untuk halaman lamar (wawancara suara, F2-03); halaman lain tetap menolaknya.
    expect(h["permissions-policy"], jalur).toContain(jalur.startsWith("/lamar/") ? "microphone=(self)" : "microphone=()");
  });
}
