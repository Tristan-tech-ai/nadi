import { describe, expect, it } from "vitest";
import { bacaRupiahBulat, biayaJam, formatLamaMenit, menitSah, rapikanMinggu, STATUS_RENCANA, totalUangSaku } from "./magang";

describe("uang saku", () => {
  it("total dari tiga bagian, kosong dihitung 0", () => {
    expect(totalUangSaku({ transport: 300_000, makan: 450_000, insentif: 0 })).toBe(750_000);
    expect(totalUangSaku({})).toBe(0);
    expect(totalUangSaku(null)).toBe(0);
  });

  it("isian rupiah dibaca bulat: titik ribuan dan awalan Rp boleh, kosong jadi null", () => {
    expect(bacaRupiahBulat("30.000")).toEqual({ nilai: 30_000 });
    expect(bacaRupiahBulat("Rp1.250.000")).toEqual({ nilai: 1_250_000 });
    expect(bacaRupiahBulat(" 45000 ")).toEqual({ nilai: 45_000 });
    expect(bacaRupiahBulat("")).toEqual({ nilai: null });
    expect(bacaRupiahBulat("-5")).toEqual({ galat: true });
    expect(bacaRupiahBulat("12,5")).toEqual({ galat: true });
    expect(bacaRupiahBulat("tiga puluh")).toEqual({ galat: true });
  });
});

describe("buku jam", () => {
  it("biaya = menit x tarif / 60, dibulatkan ke rupiah", () => {
    expect(biayaJam(90, 30_000)).toBe(45_000);
    expect(biayaJam(30, 30_000)).toBe(15_000);
    expect(biayaJam(7, 10_000)).toBe(1_167);
    expect(biayaJam(90, null)).toBe(0);
  });

  it("menit sah 1 sampai 600, bilangan bulat", () => {
    expect(menitSah(1)).toBe(true);
    expect(menitSah(600)).toBe(true);
    expect(menitSah(0)).toBe(false);
    expect(menitSah(601)).toBe(false);
    expect(menitSah(1.5)).toBe(false);
    expect(menitSah(Number.NaN)).toBe(false);
  });

  it("lama waktu ditulis jam dan menit", () => {
    expect(formatLamaMenit(90)).toBe("1 jam 30 menit");
    expect(formatLamaMenit(45)).toBe("45 menit");
    expect(formatLamaMenit(120)).toBe("2 jam");
    expect(formatLamaMenit(0)).toBe("0 menit");
  });
});

describe("rencana mingguan", () => {
  it("baris kosong dibuang, isian dirapikan, nomor minggu urut dari isian", () => {
    const r = rapikanMinggu([
      { minggu: "1", keahlian: "  Kenal mesin ", target: " Membersihkan grup head " },
      { minggu: "", keahlian: "", target: "" },
      { minggu: "2", keahlian: "Espresso", target: "" },
    ]);
    expect(r).toEqual({ baris: [{ minggu: 1, keahlian: "Kenal mesin", target: "Membersihkan grup head" }, { minggu: 2, keahlian: "Espresso", target: null }] });
  });

  it("baris tanpa keahlian atau nomor minggu salah ditolak dengan pesan yang menyebut barisnya", () => {
    expect(rapikanMinggu([{ minggu: "1", keahlian: "", target: "Target saja" }])).toEqual({ galat: "Baris 1: tulis keahlian yang dilatih." });
    expect(rapikanMinggu([{ minggu: "0", keahlian: "Kasir", target: "" }])).toEqual({ galat: "Baris 1: nomor minggu 1 sampai 999." });
    expect(rapikanMinggu([{ minggu: "1", keahlian: "x".repeat(121), target: "" }])).toEqual({ galat: "Baris 1: keahlian paling panjang 120 huruf." });
  });

  it("paling banyak 52 baris", () => {
    const baris = Array.from({ length: 53 }, (_, i) => ({ minggu: String(i + 1), keahlian: "Latihan", target: "" }));
    expect(rapikanMinggu(baris)).toEqual({ galat: "Rencana mingguan paling banyak 52 baris; sekarang 53." });
    expect("baris" in rapikanMinggu(baris.slice(0, 52))).toBe(true);
  });

  it("empat status rencana berlabel", () => {
    expect(Object.keys(STATUS_RENCANA)).toEqual(["rencana", "jalan", "selesai", "batal"]);
  });
});
