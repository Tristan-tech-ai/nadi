import { describe, expect, it } from "vitest";
import { bacaTampilan, halaman, hitungJenis, hrefFeed, jenisDariAksi, SATU_HARI_MS, usulanBaru } from "./feed";

describe("feed: jenis dari aksi", () => {
  it("memakai awalan sebelum titik pertama", () => {
    expect(jenisDariAksi("uang.keluar")).toBe("uang");
    expect(jenisDariAksi("uang.tagihan")).toBe("uang");
    expect(jenisDariAksi("orang.buat")).toBe("orang");
    expect(jenisDariAksi("izin.setujui")).toBe("izin");
    expect(jenisDariAksi("rekrut.pelamar")).toBe("rekrut");
    expect(jenisDariAksi("dokumen.slip_gaji")).toBe("dokumen");
    expect(jenisDariAksi("dokumen.surat.lampiran")).toBe("dokumen");
  });
  it("aksi lain, tanpa titik, atau kosong jatuh ke lainnya", () => {
    expect(jenisDariAksi("berkas.tinjau")).toBe("lainnya");
    expect(jenisDariAksi("absen.impor")).toBe("lainnya");
    expect(jenisDariAksi("catatan")).toBe("lainnya");
    expect(jenisDariAksi("uang")).toBe("uang");
    expect(jenisDariAksi("uangkeluar.x")).toBe("lainnya");
    expect(jenisDariAksi("")).toBe("lainnya");
    expect(jenisDariAksi(".uang")).toBe("lainnya");
  });
});

describe("feed: membaca parameter", () => {
  it("bawaan bila kosong", () => {
    expect(bacaTampilan({})).toEqual({ jenis: null, urut: "mendesak", lagi: 0 });
  });
  it("offset dibulatkan ke kelipatan 20 dan nilai aneh ditolak", () => {
    expect(bacaTampilan({ lagi: "20" }).lagi).toBe(20);
    expect(bacaTampilan({ lagi: "45" }).lagi).toBe(40);
    expect(bacaTampilan({ lagi: "-20" }).lagi).toBe(0);
    expect(bacaTampilan({ lagi: "1e3" }).lagi).toBe(0);
    expect(bacaTampilan({ lagi: "abc" }).lagi).toBe(0);
    expect(bacaTampilan({ lagi: "999999999" }).lagi).toBe(100_000);
    expect(bacaTampilan({ lagi: ["40", "60"] }).lagi).toBe(40);
  });
  it("jenis dan urut hanya dari daftar", () => {
    expect(bacaTampilan({ jenis: "uang", urut: "terbaru" })).toEqual({ jenis: "uang", urut: "terbaru", lagi: 0 });
    expect(bacaTampilan({ jenis: "lainnya" }).jenis).toBe("lainnya");
    expect(bacaTampilan({ jenis: "Uang" }).jenis).toBeNull();
    expect(bacaTampilan({ jenis: "berkas" }).jenis).toBeNull();
    expect(bacaTampilan({ urut: "lama" }).urut).toBe("mendesak");
  });
  it("tautan menulis parameter dengan urutan tetap dan membuang bawaan", () => {
    expect(hrefFeed({})).toBe("/app");
    expect(hrefFeed({ jenis: null, urut: "mendesak", lagi: 0 })).toBe("/app");
    expect(hrefFeed({ lagi: 20 })).toBe("/app?lagi=20");
    expect(hrefFeed({ lagi: 40, urut: "terbaru", jenis: "dokumen" })).toBe("/app?jenis=dokumen&urut=terbaru&lagi=40");
  });
  it("tautan dan bacaan saling cocok", () => {
    const t = { jenis: "izin", urut: "terbaru", lagi: 60 } as const;
    expect(bacaTampilan(Object.fromEntries(new URL(hrefFeed(t), "http://x").searchParams))).toEqual(t);
  });
});

describe("feed: hitungan halaman", () => {
  it("25 usulan: halaman pertama 1-20, sisa 5", () => {
    expect(halaman(25, 0)).toEqual({ dari: 1, sampai: 20, sisa: 5, berikut: 20, sebelum: null, ukuranBerikut: 5, lewat: false });
  });
  it("25 usulan: halaman kedua 21-25, tanpa sisa, bisa kembali", () => {
    expect(halaman(25, 20)).toEqual({ dari: 21, sampai: 25, sisa: 0, berikut: null, sebelum: 0, ukuranBerikut: 0, lewat: false });
  });
  it("tepat 20 tidak menyisakan apa pun", () => {
    expect(halaman(20, 0)).toMatchObject({ dari: 1, sampai: 20, sisa: 0, berikut: null });
  });
  it("100 usulan di halaman ketiga", () => {
    expect(halaman(100, 40)).toMatchObject({ dari: 41, sampai: 60, sisa: 40, berikut: 60, sebelum: 20, ukuranBerikut: 20 });
  });
  it("kosong dan offset melewati jumlah", () => {
    expect(halaman(0, 0)).toMatchObject({ dari: 0, sampai: 0, sisa: 0, berikut: null, sebelum: null, lewat: false });
    expect(halaman(5, 20)).toMatchObject({ dari: 0, sampai: 0, sisa: 0, berikut: null, sebelum: 0, lewat: true });
  });
});

describe("feed: jumlah per jenis dan penanda baru", () => {
  it("lainnya adalah sisa dari total", () => {
    expect(hitungJenis(34, { uang: 10, orang: 1, izin: 3, rekrut: 6, dokumen: 4 })).toEqual({ uang: 10, orang: 1, izin: 3, rekrut: 6, dokumen: 4, lainnya: 10 });
    expect(hitungJenis(3, { uang: 2, orang: 2, izin: 0, rekrut: 0, dokumen: 0 }).lainnya).toBe(0);
  });
  it("baru bila kurang dari 24 jam", () => {
    const sekarang = Date.parse("2026-11-01T04:00:00Z");
    expect(usulanBaru("2026-11-01T03:59:00Z", sekarang)).toBe(true);
    expect(usulanBaru(new Date(sekarang - SATU_HARI_MS + 1000).toISOString(), sekarang)).toBe(true);
    expect(usulanBaru(new Date(sekarang - SATU_HARI_MS).toISOString(), sekarang)).toBe(false);
    expect(usulanBaru("2026-10-30T04:00:00+00:00", sekarang)).toBe(false);
    expect(usulanBaru("2026-11-01T04:00:05Z", sekarang)).toBe(true);
    expect(usulanBaru("bukan tanggal", sekarang)).toBe(false);
  });
});
