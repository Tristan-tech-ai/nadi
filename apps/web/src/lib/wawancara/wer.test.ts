import { describe, expect, it } from "vitest";
import { normalisasi, wer, werKorpus } from "./wer";

describe("normalisasi", () => {
  it("huruf kecil, tanda baca dibuang, kata ulang tetap satu kata", () => {
    expect(normalisasi("Saya pernah jadi Pelayan, di kafe-kafe Denpasar!")).toEqual(["saya", "pernah", "jadi", "pelayan", "di", "kafe-kafe", "denpasar"]);
    expect(normalisasi("  “Bisa  shift  malam?”  ")).toEqual(["bisa", "shift", "malam"]);
    expect(normalisasi("Gaji Rp3.500.000 - cukup")).toEqual(["gaji", "rp3", "500", "000", "cukup"]);
  });
});

describe("wer", () => {
  it("sama persis = 0, beda tanda baca dan huruf besar tidak dihitung", () => {
    expect(wer("Saya siap kerja shift malam.", "saya siap kerja shift malam").wer).toBe(0);
  });
  it("menghitung substitusi, hapus, dan sisip", () => {
    // rujukan 5 kata: satu kata salah, satu hilang, satu tambahan
    const h = wer("saya pernah jadi pelayan kafe", "saya pernah menjadi pelayan di");
    expect(h).toMatchObject({ kata: 5 });
    expect(h.substitusi + h.hapus + h.sisip).toBe(2);
    expect(h.wer).toBeCloseTo(0.4);
    expect(wer("satu dua tiga", "satu tiga")).toMatchObject({ hapus: 1, substitusi: 0, sisip: 0 });
    expect(wer("satu tiga", "satu dua tiga")).toMatchObject({ sisip: 1, substitusi: 0, hapus: 0 });
    expect(wer("satu dua", "satu tiga")).toMatchObject({ substitusi: 1, wer: 0.5 });
  });
  it("hipotesis kosong = semua kata hilang; rujukan kosong ditangani", () => {
    expect(wer("satu dua tiga", "")).toMatchObject({ wer: 1, hapus: 3 });
    expect(wer("", "").wer).toBe(0);
    expect(wer("", "halo").wer).toBe(1);
  });
});

describe("werKorpus", () => {
  it("dibobot jumlah kata, bukan rata-rata per klip", () => {
    const k = werKorpus([
      { rujukan: "a b c d e f g h i j", hipotesis: "a b c d e f g h i j" },
      { rujukan: "x y", hipotesis: "x z" },
    ]);
    expect(k.kata).toBe(12);
    expect(k.wer).toBeCloseTo(1 / 12);
  });
});
