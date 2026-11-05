import { describe, expect, it } from "vitest";
import { KODE_MODUL, MODUL, halamanTersembunyi, modulNyala } from "./fitur-usaha";
import { SEMUA_HALAMAN, ruangUntuk } from "./ruang";

const menu = (industri: string | null, pilihan: Record<string, unknown> | null = null) => {
  const sembunyi = halamanTersembunyi(modulNyala(industri, pilihan));
  return ruangUntuk("pemilik").flatMap((r) => r.halaman.map((x) => x.href)).filter((h) => !sembunyi.has(h));
};

describe("fitur per jenis usaha", () => {
  it("kode modul sama dengan app.feature_modules() di SQL dan setiap halaman modul ada di peta ruang", () => {
    expect(KODE_MODUL).toEqual(["kasir", "stok", "produksi", "dagang_luar", "servis", "janji", "proyek", "mata", "crm", "layanan"]);
    const ada = new Set(SEMUA_HALAMAN.map((x) => x.href));
    for (const m of MODUL) for (const h of m.halaman) expect(ada.has(h), h).toBe(true);
  });
  it("toko dan klinik melihat menu berbeda", () => {
    const toko = menu("toko"), klinik = menu("klinik");
    expect(toko).toContain("/app/kasir");
    expect(klinik).not.toContain("/app/kasir");
    expect(klinik).toContain("/app/janji-temu");
    expect(toko).not.toContain("/app/janji-temu");
    expect(toko).not.toContain("/app/servis");
    // Inti selalu ada.
    for (const inti of ["/app", "/app/invoice", "/app/gaji", "/app/orang", "/app/buku", "/app/perusahaan"]) {
      expect(toko).toContain(inti);
      expect(klinik).toContain(inti);
    }
  });
  it("usaha tanpa paket melihat semua; pilihan pemilik menang atas bawaan", () => {
    expect(menu(null)).toHaveLength(ruangUntuk("pemilik").flatMap((r) => r.halaman).length);
    expect(menu("klinik", { kasir: true })).toContain("/app/kasir");
    expect(menu("toko", { kasir: false })).not.toContain("/app/kasir");
    expect(menu("toko", { kasir: "ya" })).toContain("/app/kasir"); // nilai bukan boolean diabaikan
  });
});
