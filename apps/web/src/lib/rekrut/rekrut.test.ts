import { describe, expect, it } from "vitest";
import { cekLowongan } from "./bias";
import { ATRIBUT_TERLINDUNGI, catatanRubrik, nilaiPelamar, rubrikDariTopi, saringCv } from "./rubrik";

describe("cekLowongan", () => {
  it("kriteria F2-02: 'maks 25 th, berpenampilan menarik' diberi peringatan usia dan penampilan", () => {
    const p = cekLowongan("Pelayan shift malam. Syarat: maks 25 th, berpenampilan menarik.");
    expect(p.map((x) => x.kode)).toEqual(["usia", "penampilan"]);
    expect(p[0].kutipan).toBe("maks 25 th");
    expect(p[1].kutipan).toBe("berpenampilan menarik");
    expect(p[0].alasan).toContain("M/6/HK.04/V/2025");
  });

  it("menangkap bentuk lain tiap jenis", () => {
    const kode = (t: string) => cekLowongan(t).map((x) => x.kode);
    expect(kode("Usia 18-30 tahun")).toEqual(["usia"]);
    expect(kode("umur maksimal 35")).toEqual(["usia"]);
    expect(kode("Good looking, TB min 160")).toEqual(["penampilan"]);
    expect(kode("Belum menikah")).toEqual(["status_kawin"]);
    expect(kode("Kasir wanita")).toEqual(["jenis_kelamin"]);
    expect(kode("Diutamakan muslimah berjilbab")).toEqual(["agama"]);
    expect(kode("Kulit putih bersih, suku apa saja")).toEqual(["suku_ras"]);
    expect(kode("Bukan anggota partai")).toEqual(["politik"]);
    expect(kode("Sehat jasmani dan rohani, tidak cacat")).toEqual(["disabilitas"]);
  });

  it("tidak menandai syarat kerja yang wajar", () => {
    expect(cekLowongan("Pengalaman minimal 2 tahun sebagai barista. Bisa shift malam, rapi dan bersih, jujur.")).toEqual([]);
    expect(cekLowongan("Pengalaman kerja maksimal 10 tahun tidak masalah, gaji Rp3.000.000")).toEqual([]);
    expect(cekLowongan("Mampu mengangkat karung 25 kg, bisa bahasa Jawa")).toEqual([]);
  });

  it("menemukan batas usia setelah syarat pengalaman", () => {
    expect(cekLowongan("Pengalaman minimal 2 tahun, maksimal 30 tahun").map((x) => x.kutipan)).toEqual(["maksimal 30 tahun"]);
  });
});

describe("rubrik dari topi", () => {
  const pelayan = { nama: "Pelayan", keahlian: ["Melayani pelanggan"], tanggung_jawab: ["Menyambut tamu", "Mencatat pesanan", "Membersihkan meja"] };

  it("menyusun kriteria berbobot dari topi (teks atau objek)", () => {
    const r = rubrikDariTopi(pelayan);
    expect(r.map((k) => [k.jenis, k.bobot])).toEqual([["pengalaman", 3], ["keahlian", 2], ["tugas", 1], ["tugas", 1], ["tugas", 1]]);
    expect(rubrikDariTopi({ nama: "Koki", keahlian: [{ nama: "Memasak", level: 2 }], tanggung_jawab: [{ tugas: "Memasak pesanan", raci: "R" }] }).map((k) => k.label))
      .toEqual(["Pernah bekerja sebagai koki", "Memasak", "Memasak pesanan"]);
  });

  it("menilai dari peran dan keahlian dengan imbuhan Indonesia", () => {
    const cv = saringCv({ posisi: "Pelayan", pengalaman: [{ tempat: "Kafe Senja", peran: "Pelayan", tahun: "2022-2024" }], keahlian: ["Pelayanan pelanggan", "Pencatatan pesanan"] });
    const n = nilaiPelamar(rubrikDariTopi(pelayan), cv);
    expect(n.cocok).toEqual(["Pernah bekerja sebagai pelayan", "Melayani pelanggan", "Mencatat pesanan"]);
    expect(n.kurang).toEqual(["Menyambut tamu", "Membersihkan meja"]);
    expect(n.skor).toBe(75); // (3 + 2 + 1) / 8
  });

  it("atribut terlindungi tidak ikut skor: CV yang hanya berbeda di atribut itu bernilai sama", () => {
    const dasar = { posisi: "Kasir", pengalaman: [{ peran: "Kasir minimarket", tahun: "2021-2023" }], keahlian: ["Hitung uang"] };
    const r = rubrikDariTopi({ nama: "Kasir", keahlian: ["Hitung uang", "Melayani pelanggan"], tanggung_jawab: ["Menutup kas harian"] });
    const a = nilaiPelamar(r, saringCv({ ...dasar, nama: "Wulan Astuti", usia: 41, jenis_kelamin: "perempuan", agama: "Hindu", status_kawin: "menikah", foto: "x.jpg", tinggi_badan: 150 }));
    const b = nilaiPelamar(r, saringCv({ ...dasar, nama: "Budi Santoso", usia: 22, jenis_kelamin: "laki-laki", agama: "Islam", status_kawin: "lajang", tinggi_badan: 180 }));
    expect(a).toEqual(b);
    const aman = saringCv({ ...dasar, ...Object.fromEntries(ATRIBUT_TERLINDUNGI.map((k) => [k, "isi"])) });
    expect(Object.keys(aman).sort()).toEqual(["keahlian", "peran", "posisi"]);
    // Kata rubrik yang hanya ada di atribut terlindungi tidak boleh menambah skor sedikit pun.
    const bocor = Object.fromEntries(ATRIBUT_TERLINDUNGI.map((k) => [k, "kasir hitung uang melayani pelanggan menutup kas"]));
    expect(nilaiPelamar(r, saringCv(bocor)).skor).toBe(0);
  });

  it("rubrik kosong memberi skor null", () => {
    expect(nilaiPelamar([], saringCv({})).skor).toBeNull();
    expect(catatanRubrik("Pelayan", nilaiPelamar([], saringCv({})))).toBeNull();
  });

  it("catatan kartu Feed menyebut angka, yang kurang, dan yang tidak dinilai", () => {
    const n = nilaiPelamar(rubrikDariTopi(pelayan), saringCv({ posisi: "Pelayan", keahlian: ["Melayani pelanggan"] }));
    expect(catatanRubrik("Pelayan", n)).toBe(
      "Rubrik topi Pelayan: cocok 2 dari 5 (skor 63). Belum terlihat di CV: Menyambut tamu, Mencatat pesanan, Membersihkan meja. Umur, jenis kelamin, agama, foto, dan nama tidak dinilai.",
    );
  });
});
