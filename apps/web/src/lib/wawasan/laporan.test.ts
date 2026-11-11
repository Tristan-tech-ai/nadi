import { describe, expect, it } from "vitest";
import { bacaPilihan, keCsv, selCsv, sumberMod } from "./laporan";

describe("bacaPilihan", () => {
  it("sumber tak dikenal jatuh ke orang dengan semua kolom", () => {
    expect(bacaPilihan({ sumber: "slip_gaji" })).toEqual({ sumber: "orang", kolom: ["nama", "jenis", "status", "telepon", "email", "dibuat_at"], cari: "" });
  });
  it("kolom di luar daftar putih dibuang, urutan mengikuti daftar", () => {
    expect(bacaPilihan({ sumber: "invoice", kolom: ["total", "pelanggan", "baris", "kode_verifikasi", "total"] }).kolom).toEqual(["pelanggan", "total"]);
    expect(bacaPilihan({ sumber: "produk", kolom: "harga_jual,nama,perusahaan_id" }).kolom).toEqual(["nama", "harga_jual"]);
  });
  it("ganti sumber: kolom sumber lama tidak dibawa walau namanya sama", () => {
    expect(bacaPilihan({ sumber: "invoice", asal: "orang", kolom: ["nama", "status"] }).kolom).toEqual(["nomor", "pelanggan", "tanggal", "jatuh_tempo", "total", "status", "lunas_tanggal"]);
    expect(bacaPilihan({ sumber: "invoice", asal: "invoice", kolom: ["status"] }).kolom).toEqual(["status"]);
  });
  it("kata saring dibersihkan dari karakter operator PostgREST dan dipotong", () => {
    expect(bacaPilihan({ cari: "Bu%di,or(nama.eq.x)" }).cari).toBe("Bu di or nama.eq.x");
    expect(bacaPilihan({ cari: "a".repeat(90) }).cari).toHaveLength(60);
  });
});

describe("CSV", () => {
  it("rumus Excel dinetralkan, pemisah dan kutip di-escape, larik digabung", () => {
    expect(selCsv("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(selCsv("-10")).toBe("'-10");
    expect(selCsv(-10)).toBe("-10");
    expect(selCsv(["karyawan", "magang"])).toBe("karyawan, magang");
    expect(selCsv("Toko; Jaya")).toBe("\"Toko; Jaya\"");
    expect(selCsv(null)).toBe("");
  });
  it("judul dari kamus, baris per data", () => {
    expect(keCsv([{ nama: "Budi", status: "aktif" }], ["nama", "status"], { nama: "Nama", status: "Status" })).toBe("Nama;Status\r\nBudi;aktif\r\n");
  });
});

describe("X-18 sumber kerja, proyek, dan fitur tambahan", () => {
  const mods = [{ id: "00000000-0000-4000-8000-000000000001", kode: "log-rapat", nama: "Log rapat", manifest: { koleksi: [
    { kode: "catatan", nama: "Rapat", judul: "judul", bidang: [{ kode: "judul", label: "Judul", tipe: "teks" }, { kode: "peserta", label: "Peserta", tipe: "orang" },
      { kode: "skor", label: "Skor", tipe: "rumus" }, { kode: "lampiran", label: "Lampiran", tipe: "berkas" }] },
    { kode: "tindak", nama: "Tindak lanjut", judul: "judul", status: { awal: "a" }, bidang: [{ kode: "judul", label: "Yang dikerjakan", tipe: "teks" },
      { kode: "rapat", label: "Dari rapat", tipe: "rujukan", koleksi: "catatan" }] },
  ] } }];
  it("sumber kerja dan proyek berdaftar putih", () => {
    expect(bacaPilihan({ sumber: "kerja", kolom: ["judul", "pelaksana_id", "status"] }).kolom).toEqual(["judul", "status"]);
    expect(bacaPilihan({ sumber: "proyek" }).kolom).toEqual(["nama", "status", "tipe", "pola", "mulai", "target"]);
  });
  it("sumber mod: kolom dari manifest tanpa rumus dan berkas, status hanya bila ada alur, rujukan ke judul koleksi tujuan", () => {
    const s = sumberMod(mods);
    expect(s.map((x) => x.kunci)).toEqual(["mod:log-rapat:catatan", "mod:log-rapat:tindak"]);
    expect(s[0].kolom).toEqual(["judul", "peserta", "dibuat_at"]);
    expect(s[1].kolom).toEqual(["judul", "rapat", "status", "dibuat_at"]);
    expect(s[1].ruj).toEqual({ rapat: "judul" });
    expect(s[0].label.peserta).toBe("Peserta");
  });
  it("bacaPilihan menerima sumber mod yang aktif saja dan menolak kolom di luar manifest", () => {
    const s = sumberMod(mods);
    const p = bacaPilihan({ sumber: "mod:log-rapat:catatan", kolom: ["peserta", "skor", "perusahaan_id", "judul"] }, s);
    expect(p).toMatchObject({ sumber: "mod:log-rapat:catatan", kolom: ["judul", "peserta"] });
    expect(p.mod?.modId).toBe(mods[0].id);
    expect(bacaPilihan({ sumber: "mod:lain:catatan" }, s).sumber).toBe("orang");
    expect(bacaPilihan({ sumber: "mod:log-rapat:catatan", cari: "a%b,(c)" }, s).cari).toBe("a b  c");
  });
  it("isi catatan mod yang mirip rumus dinetralkan di CSV", () => {
    expect(keCsv([{ judul: "=HYPERLINK(\"http://x\")", peserta: "Sari" }], ["judul", "peserta"], { judul: "Judul", peserta: "Peserta" }))
      .toBe("Judul;Peserta\r\n\"'=HYPERLINK(\"\"http://x\"\")\";Sari\r\n");
  });
});
