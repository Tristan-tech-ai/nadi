import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { namaSkill, periksaSkill, susunSkill, zipSkill, type DataSkill } from "./paket";

// Aturan format dari spesifikasi Agent Skills (https://agentskills.io/specification, dibaca 1 Nov 2026): name 1-64 huruf kecil,
// angka, tanda hubung, tidak diawali/diakhiri/berurutan tanda hubung, sama dengan nama folder; description 1-1024; SKILL.md < 500 baris.
const DATA: DataSkill = {
  usaha: { nama: "Warung Bu Sari & Anak", kode: "WRGSRA", industri: "fnb", zona: "Asia/Makassar" },
  mcpUrl: "https://nadi.contoh.id/api/mcp",
  topi: [{ nama: "Kasir", orang: 2 }, { nama: "Koki", orang: 1 }],
  polaKerja: "6 hari kerja seminggu",
  izin: [{ jenis: "sakit", otomatis: true, maksHari: 1, butuhBukti: true }, { jenis: "cuti", otomatis: false, maksHari: null, butuhBukti: false }],
  nomor: [{ jenis: "SK", nama: "Surat keputusan", templat: "{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}" }],
  akun: [{ kode: "1-100", nama: "Kas" }, { kode: "4-100", nama: "Penjualan" }],
  dibuat: "2026-11-01",
};

describe("namaSkill sesuai spesifikasi", () => {
  it.each([
    ["Warung Bu Sari & Anak", "nadi-warung-bu-sari-anak"],
    ["  TOKO--Maju   Jaya!! ", "nadi-toko-maju-jaya"],
    ["Café Ñusantara", "nadi-cafe-nusantara"],
    ["###", "nadi-usaha"],
  ])("%s", (nama, harap) => expect(namaSkill(nama)).toBe(harap));
  it("paling panjang 64 dan tidak berakhir tanda hubung", () => {
    const n = namaSkill("Usaha ".repeat(30) + "x");
    expect(n.length).toBeLessThanOrEqual(64);
    expect(n).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("susunSkill", () => {
  const p = susunSkill(DATA);
  const skill = p.berkas["SKILL.md"];
  it("frontmatter name sama dengan nama folder, description sah, lolos pemeriksaan", () => {
    expect(p.nama).toBe("nadi-warung-bu-sari-anak");
    expect(skill.startsWith(`---\nname: ${p.nama}\n`)).toBe(true);
    expect(periksaSkill(p.nama, skill)).toEqual([]);
  });
  it("memuat cara memakai server MCP Nadi dan aturan usaha", () => {
    expect(skill).toContain(DATA.mcpUrl);
    expect(skill).toContain("buat_usulan");
    expect(skill).toContain("Rp1.250.000");
    expect(p.berkas["references/usaha.md"]).toContain("Kasir (2 orang)");
    expect(p.berkas["references/usaha.md"]).toContain("{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}");
    expect(p.berkas["references/usaha.md"]).toContain("1-100 Kas");
    expect(p.berkas["references/usaha.md"]).toContain("Sakit: disetujui otomatis sampai 1 hari, wajib bukti");
  });
  it("tidak memuat data pribadi: hanya jumlah orang per topi, tanpa nama orang", () => {
    // DataSkill memang tidak punya tempat untuk nama orang, gaji, atau NIK; pastikan berkas tidak menyebut kata itu sebagai data.
    expect(skill + p.berkas["references/usaha.md"]).not.toMatch(/\b\d{16}\b/);
  });
  it("tanpa tanda pisah panjang dan tanpa kata terlarang VOICE", () => {
    const semua = Object.values(p.berkas).join("\n");
    expect(semua).not.toMatch(/[–—]/);
    expect(semua.toLowerCase()).not.toMatch(/silakan|revolusioner|inovatif|seamless/);
  });
});

describe("periksaSkill menolak paket yang tidak sah", () => {
  const isi = (nama: string, desk: string, badan = "Isi.") => `---\nname: ${nama}\ndescription: ${desk}\n---\n\n${badan}\n`;
  it.each([
    ["Nadi-Usaha", "Nadi-Usaha", "huruf besar"],
    ["nadi--usaha", "nadi--usaha", "berurutan"],
    ["-nadi", "-nadi", "tanda hubung"],
  ])("name %s", (folder, nama, pesan) => expect(periksaSkill(folder, isi(nama, "Cara kerja usaha.")).join(" ")).toMatch(pesan));
  it("name beda dengan folder", () => expect(periksaSkill("nadi-a", isi("nadi-b", "x")).join(" ")).toMatch(/folder/));
  it("description kosong atau > 1024", () => {
    expect(periksaSkill("nadi-a", isi("nadi-a", "")).join(" ")).toMatch(/description/);
    expect(periksaSkill("nadi-a", isi("nadi-a", "x".repeat(1025))).join(" ")).toMatch(/1024/);
  });
  it("tanpa frontmatter atau badan >= 500 baris", () => {
    expect(periksaSkill("nadi-a", "Isi saja").join(" ")).toMatch(/frontmatter/);
    expect(periksaSkill("nadi-a", isi("nadi-a", "x", "baris\n".repeat(500))).join(" ")).toMatch(/500/);
  });
});

describe("zipSkill", () => {
  it("zip berisi satu folder bernama skill dengan SKILL.md dan references", () => {
    const p = susunSkill(DATA);
    const isi = unzipSync(zipSkill(p));
    expect(Object.keys(isi).sort()).toEqual([`${p.nama}/SKILL.md`, `${p.nama}/references/usaha.md`]);
    expect(strFromU8(isi[`${p.nama}/SKILL.md`])).toBe(p.berkas["SKILL.md"]);
  });
});
