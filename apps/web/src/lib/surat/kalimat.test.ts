import { describe, expect, it } from "vitest";
import { pahamiKalimat, susunSurat, tanggalPanjang } from "./kalimat";

const HARI = "2026-11-01";
const ORANG = [
  { id: "o1", nama: "Budi Santoso" },
  { id: "o2", nama: "Sari Lestari" },
  { id: "o3", nama: "Andi Pratama" },
  { id: "o4", nama: "Andi Wijaya" },
];

describe("pahamiKalimat", () => {
  it("contoh PLAN: SK mutasi Budi ke cabang Denpasar mulai 1 Desember", () => {
    expect(pahamiKalimat("Buatkan SK mutasi Budi ke cabang Denpasar mulai 1 Desember", ORANG, HARI)).toMatchObject({
      jenis: "sk_mutasi", orang: { id: "o1", nama: "Budi Santoso" }, tujuan: "cabang Denpasar", mulai: "2026-12-01", kurang: [],
    });
  });
  it("surat tugas: tujuan, keperluan, lama, besok", () => {
    expect(pahamiKalimat("Surat tugas Sari ke Surabaya untuk ikut pameran selama 3 hari mulai besok", ORANG, HARI)).toMatchObject({
      jenis: "surat_tugas", orang: { id: "o2" }, tujuan: "Surabaya", keperluan: "ikut pameran", lamaHari: 3, mulai: "2026-11-02", kurang: [],
    });
  });
  it("surat keterangan kerja cukup nama orang", () => {
    expect(pahamiKalimat("tolong surat keterangan kerja untuk Budi", ORANG, HARI)).toMatchObject({
      jenis: "keterangan_kerja", orang: { id: "o1" }, kurang: [],
    });
  });
  it("nama depan sama: tidak menebak, dua kandidat, tanggal lewat jadi tahun depan", () => {
    const h = pahamiKalimat("SK mutasi Andi ke gudang mulai 5 Jan", ORANG, HARI);
    expect(h.orang).toBeNull();
    expect(h.kandidat.map((k) => k.id)).toEqual(["o3", "o4"]);
    expect(h.mulai).toBe("2027-01-05");
    expect(h.kurang).toEqual(["orang"]);
  });
  it("nama lengkap mengalahkan nama depan; hari ini", () => {
    expect(pahamiKalimat("surat tugas Andi Wijaya ke Bali untuk survei lokasi mulai hari ini", ORANG, HARI)).toMatchObject({
      orang: { id: "o4" }, tujuan: "Bali", mulai: HARI,
    });
  });
  it("jenis tidak dikenal", () => {
    expect(pahamiKalimat("tolong buat surat", ORANG, HARI).kurang).toEqual(["jenis"]);
  });
  it("tanggal bertahun, ISO, dan tanggal mustahil", () => {
    expect(pahamiKalimat("SK mutasi Budi ke Ubud mulai 3 Februari 2027", ORANG, HARI).mulai).toBe("2027-02-03");
    expect(pahamiKalimat("SK mutasi Budi ke Ubud mulai 2026-12-15", ORANG, HARI).mulai).toBe("2026-12-15");
    const h = pahamiKalimat("SK mutasi Budi ke Ubud mulai 31 Februari", ORANG, HARI);
    expect(h.mulai).toBeNull();
    expect(h.kurang).toEqual(["mulai"]);
  });
  it("yang kurang disebut per isian", () => {
    expect(pahamiKalimat("SK mutasi Budi", ORANG, HARI).kurang).toEqual(["tujuan", "mulai"]);
    expect(pahamiKalimat("surat tugas Sari ke Malang mulai besok", ORANG, HARI).kurang).toEqual(["keperluan"]);
  });
});

describe("susunSurat", () => {
  it("tanggalPanjang memakai nama bulan lengkap", () => {
    expect(tanggalPanjang("2026-12-01")).toBe("1 Desember 2026");
  });
  it("SK mutasi", () => {
    const s = susunSurat("sk_mutasi", { usaha: "Warung Bu Sari", nama: "Budi Santoso", tujuan: "cabang Denpasar", mulai: "2026-12-01" });
    expect(s.judul).toBe("Surat Keputusan Mutasi");
    expect(s.isi.join(" ")).toContain("Budi Santoso");
    expect(s.isi.join(" ")).toContain("cabang Denpasar");
    expect(s.isi.join(" ")).toContain("1 Desember 2026");
  });
  it("surat tugas dengan lama hari menyebut tanggal selesai", () => {
    const s = susunSurat("surat_tugas", { usaha: "Warung Bu Sari", nama: "Sari Lestari", tujuan: "Surabaya", keperluan: "ikut pameran", mulai: "2026-11-30", lamaHari: 3 });
    expect(s.isi.join(" ")).toContain("30 November 2026 sampai 2 Desember 2026");
  });
  it("tanpa tanda pisah panjang", () => {
    const s = susunSurat("keterangan_kerja", { usaha: "Warung Bu Sari", nama: "Budi Santoso" });
    expect(s.judul + s.isi.join(" ")).not.toMatch(/[–—]/);
  });
});
