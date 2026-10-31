import { describe, expect, it } from "vitest";
import { angkaWa, bankTalenta, LABEL_PELAMAR, pesanWa, tahapSah, tampilHp, tautanWa, tokenStatusSah, TAHAP, type LamaranBank } from "./keputusan";

describe("nomor HP", () => {
  it("data 62... jadi angka wa.me tanpa plus dan tampilan 08xx-xxxx-xxxx", () => {
    expect(angkaWa("6281234567890")).toBe("6281234567890");
    expect(angkaWa("+62 812-3456-7890")).toBe("6281234567890");
    expect(angkaWa("0812 3456 7890")).toBe("6281234567890");
    expect(tampilHp("6281234567890")).toBe("0812-3456-7890");
    expect(tampilHp("628123456789")).toBe("0812-3456-789");
  });

  it("nomor kosong atau bukan Indonesia tidak menghasilkan tautan", () => {
    expect(angkaWa(null)).toBeNull();
    expect(angkaWa("12345")).toBeNull();
    expect(angkaWa("4412345678901")).toBeNull();
    expect(tautanWa(null, "halo")).toBeNull();
  });

  it("tautan wa.me berisi nomor pelamar dan teks yang di-encode", () => {
    expect(tautanWa("6281234567890", "Halo Dewi, jam 09.00?")).toBe("https://wa.me/6281234567890?text=Halo%20Dewi%2C%20jam%2009.00%3F");
  });
});

describe("tahap dan token", () => {
  it("lima tahap, semuanya berlabel kata sehari-hari untuk pelamar", () => {
    expect(TAHAP).toEqual(["masuk", "ditinjau", "ditawari", "diterima", "ditolak"]);
    expect(LABEL_PELAMAR.ditawari).toBe("Kamu ditawari pekerjaan");
    expect(LABEL_PELAMAR.ditolak).toBe("Belum cocok kali ini");
    expect(tahapSah("ditawari")).toBe(true);
    expect(tahapSah("lulus")).toBe(false);
  });

  it("token status hanya nml_ + 64 heksa", () => {
    expect(tokenStatusSah(`nml_${"a".repeat(64)}`)).toBe(true);
    expect(tokenStatusSah(`nms_${"a".repeat(64)}`)).toBe(false);
    expect(tokenStatusSah(`nml_${"A".repeat(64)}`)).toBe(false);
  });
});

describe("pesanWa", () => {
  const isi = { nama: "Dewi Lestari", usaha: "Warung Bu Sri", lowongan: "Pelayan shift malam" };

  it("tawaran menyapa nama depan, menyebut usaha, lowongan, dan pesan pemilik", () => {
    const t = pesanWa("tawaran", { ...isi, pesan: "Mulai Senin 09.00." });
    expect(t).toMatch(/^Halo Dewi, ini dari Warung Bu Sri\./);
    expect(t).toContain("Pelayan shift malam");
    expect(t).toContain("Mulai Senin 09.00.");
  });

  it("penolakan berterima kasih, tanpa alasan, menyebut lamaran disimpan bila diizinkan", () => {
    const t = pesanWa("penolakan", { ...isi, simpan: true });
    expect(t).toContain("Terima kasih");
    expect(t).toContain("kami simpan");
    expect(pesanWa("penolakan", isi)).not.toContain("simpan");
  });

  it("tidak ada teks yang menyinggung atribut terlindungi, tanpa tanda pisah panjang dan kata terlarang", () => {
    for (const jenis of ["tawaran", "penolakan", "undangan"] as const) {
      const t = pesanWa(jenis, { ...isi, simpan: true, tautan: "https://nadi.id/lamar/ABCDEFGH" }).toLowerCase();
      expect(t).not.toMatch(/(^|[^a-z])(usia|umur|agama|suku|ras|kulit|menikah|kawin|penampilan|cantik|tampan|tinggi badan|berat badan|jenis kelamin|wanita|pria|disabilitas|cacat|hamil|logat)([^a-z]|$)/);
      expect(t).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]|silakan|mohon maaf`));
    }
  });

  it("undangan Bank Talenta membawa tautan lamar lowongan baru", () => {
    expect(pesanWa("undangan", { ...isi, tautan: "https://nadi.id/lamar/ABCDEFGH" })).toContain("lamar lewat https://nadi.id/lamar/ABCDEFGH");
  });
});

describe("bankTalenta", () => {
  const kini = new Date("2026-11-01T00:00:00Z");
  const hariLalu = (n: number) => new Date(kini.getTime() - n * 86_400_000).toISOString();
  const la = (p: Partial<LamaranBank>): LamaranBank => ({
    id: p.id ?? "x", lowongan_id: "lw-lama", nama: "Dewi", telepon: "6281200000001", tahap: "ditolak", boleh_dihubungi: true, dibuat_at: hariLalu(10), topi_id: "pelayan", ...p,
  });
  const baru = { id: "lw-baru", topi_id: "pelayan", buka: true };

  it("memilih pelamar lama bertopi sama yang memberi izin, terbaru dulu", () => {
    const b = bankTalenta([baru], [la({ id: "a", dibuat_at: hariLalu(30) }), la({ id: "b", nama: "Rudi", telepon: "6281200000002", dibuat_at: hariLalu(5) })], kini);
    expect(b.get("lw-baru")!.map((t) => t.lamaran)).toEqual(["b", "a"]);
  });

  it("menyaring: tanpa izin, sudah diterima, topi lain, lebih dari 365 hari, lowongan itu sendiri", () => {
    const b = bankTalenta([baru], [
      la({ id: "tanpa-izin", boleh_dihubungi: false }),
      la({ id: "diterima", tahap: "diterima", telepon: "6281200000003" }),
      la({ id: "topi-lain", topi_id: "kasir", telepon: "6281200000004" }),
      la({ id: "lama", dibuat_at: hariLalu(366), telepon: "6281200000005" }),
      la({ id: "di-sini", lowongan_id: "lw-baru", telepon: "6281200000006" }),
    ], kini);
    expect(b.has("lw-baru")).toBe(false);
  });

  it("satu baris per nomor HP (lamaran terbaru), dan nomor yang sudah melamar di lowongan ini disembunyikan", () => {
    const b = bankTalenta([baru], [
      la({ id: "lama", dibuat_at: hariLalu(100) }),
      la({ id: "terbaru", dibuat_at: hariLalu(3), nama: "Dewi L." }),
      la({ id: "sudah", telepon: "6281200000009" }),
      la({ id: "sudah-di-sini", lowongan_id: "lw-baru", telepon: "6281200000009", boleh_dihubungi: false }),
    ], kini);
    expect(b.get("lw-baru")).toEqual([{ lamaran: "terbaru", nama: "Dewi L.", telepon: "6281200000001", dibuat_at: hariLalu(3) }]);
  });

  it("lowongan tutup atau tanpa topi tidak punya Bank Talenta", () => {
    const b = bankTalenta([{ id: "t", topi_id: "pelayan", buka: false }, { id: "n", topi_id: null, buka: true }], [la({})], kini);
    expect(b.size).toBe(0);
  });
});
