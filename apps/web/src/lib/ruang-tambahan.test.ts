import { describe, expect, it } from "vitest";
import { cariFitur } from "./cari-fitur";
import { KATALOG_RESMI } from "./mod/katalog";
import { periksaManifest } from "./mod/pengawas";
import { ALAT_MOD, promptMod } from "./mod/prompt-mod";
import { ruangUntuk } from "./ruang";
import { susunTambahan } from "./ruang-tambahan";

const MOD = [{ kode: "proyek-agensi", nama: "Proyek agensi", ikon: "kanban", deskripsi: "Proyek klien." }, { kode: "izin-acara", nama: "Izin acara", ikon: "<svg>", deskripsi: null }];

describe("sidebar inti + Fitur tambahan (X-06)", () => {
  const ruang = susunTambahan(ruangUntuk("pemilik"), MOD);
  const tambahan = ruang.find((r) => r.id === "tambahan")!;
  it("halaman modul opsional pindah dari ruang intinya ke Fitur tambahan", () => {
    // ruang Jual hanya berisi modul opsional, jadi di sidebar seluruhnya pindah ke Fitur tambahan
    expect(ruang.find((r) => r.id === "jual")?.halaman.map((x) => x.href) ?? []).not.toContain("/app/kasir");
    expect(tambahan.halaman.map((x) => x.href)).toEqual(expect.arrayContaining(["/app/kasir", "/app/barang", "/app/proyek"]));
    // halaman inti tetap di ruangnya
    expect(ruang.find((r) => r.id === "uang")!.halaman.map((x) => x.href)).toContain("/app/invoice");
  });
  it("mod aktif menjadi halaman /app/mod/<kode>; ikon di luar daftar diabaikan; indeks tidak diulang; Tambah fitur terakhir", () => {
    const hrefs = tambahan.halaman.map((x) => x.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/app/mod/proyek-agensi", "/app/mod/izin-acara"]));
    expect(hrefs).not.toContain("/app/mod");
    expect(hrefs.at(-1)).toBe("/app/tambah-fitur");
    // ikon kanban sudah dipakai halaman modul Proyek di daftar yang sama, jadi mod memakai ikon umum (S55)
    expect(tambahan.halaman.find((x) => x.href === "/app/mod/proyek-agensi")?.ikon).toBeUndefined();
    expect(susunTambahan(ruangUntuk("pemilik"), [{ kode: "acara", nama: "Acara", ikon: "kalender", deskripsi: null }]).find((r) => r.id === "tambahan")!
      .halaman.find((x) => x.href === "/app/mod/acara")?.ikon).toBe("kalender");
    expect(tambahan.halaman.find((x) => x.href === "/app/mod/izin-acara")?.ikon).toBeUndefined();
  });
  it("staf tanpa modul menyala dan tanpa mod: ruang Fitur tambahan tidak tampil", () => {
    const staf = susunTambahan(ruangUntuk("staf").map((r) => ({ ...r, halaman: r.halaman.filter((x) => !["/app/kasir", "/app/barang", "/app/proyek", "/app/janji-temu", "/app/servis", "/app/pelanggan", "/app/jual", "/app/layanan", "/app/produksi", "/app/mata", "/app/peta-usaha", "/app/impor", "/app/ekspor"].includes(x.href)) })), []);
    expect(staf.find((r) => r.id === "tambahan")).toBeUndefined();
  });
  it("Ctrl K menemukan mod aktif lewat namanya", () => {
    const ekstra = tambahan.halaman.filter((x) => x.href.startsWith("/app/mod/")).map((x) => ({ ...x, ruang: "tambahan" }));
    expect(cariFitur("agensi", "pemilik", "id", 5, undefined, ekstra)[0]?.href).toBe("/app/mod/proyek-agensi");
    expect(cariFitur("izin acara", "pemilik", "id", 5, undefined, ekstra)[0]?.href).toBe("/app/mod/izin-acara");
  });
});

describe("katalog resmi dan prompt AI", () => {
  it("setiap paket resmi lolos pengawas yang sama dengan buatan pengguna, kode unik", () => {
    for (const p of KATALOG_RESMI) expect(periksaManifest(p.manifest), p.manifest.kode).toEqual([]);
    expect(new Set(KATALOG_RESMI.map((p) => p.manifest.kode)).size).toBe(KATALOG_RESMI.length);
  });
  it("prompt menyebut alamat, halaman Tambah fitur, semua alat mod, dan larangan menerapkan", () => {
    const p = promptMod({ alamat: "https://nadi.example/api/mcp", asal: "https://nadi.example" });
    expect(p).toContain("https://nadi.example/api/mcp");
    expect(p).toContain("https://nadi.example/app/tambah-fitur");
    for (const a of ALAT_MOD) expect(p).toContain(a);
    expect(p).toMatch(/TIDAK bisa menerapkan/);
  });
});
