import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { akurasi, langkahStatus, orangDiZona, statusAwal, type Deteksi, type StatusMeja, type Zona } from "./resep";

// Kriteria F5-01: status meja benar >= 85% pada video uji. Deteksi RF-DETR nano q8 per cuplikan disimpan oleh
// scripts/eval-mata.ts (SIMPAN_DETEKSI=1) supaya resep diuji tanpa mengunduh model.
const AKAR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "mata");
const baca = <T>(nama: string) => JSON.parse(readFileSync(join(AKAR, nama), "utf8")) as T;
const zona = baca<Zona[]>("zona.json");
const jawaban = baca<{ cuplikan: number; status: Record<string, StatusMeja>; lewat: boolean }[]>("jawaban.json");
const deteksi = baca<{ cuplikan: number; orang: Deteksi[] }[]>("deteksi-q8.json");

function jalankan(z: Zona[]) {
  const status = new Map(z.map((x) => [x.id, statusAwal()]));
  const p: StatusMeja[] = [];
  const j: StatusMeja[] = [];
  for (const c of jawaban) {
    const d = deteksi.find((x) => x.cuplikan === c.cuplikan)!.orang;
    for (const x of z) {
      const s = langkahStatus(status.get(x.id)!, orangDiZona(d, x, 0.5) > 0).status;
      status.set(x.id, s);
      p.push(s.nilai);
      j.push(c.status[x.id]);
    }
  }
  return akurasi(p, j);
}

describe("korpus Mata", () => {
  it("korpus lengkap: 60 cuplikan, 3 zona meja, ada orang lewat di lorong", () => {
    expect(jawaban).toHaveLength(60);
    expect(deteksi).toHaveLength(60);
    expect(zona.map((z) => z.jenis)).toEqual(["meja", "meja", "meja"]);
    expect(jawaban.filter((c) => c.lewat).length).toBeGreaterThan(0);
  });

  it("status meja benar >= 85% dengan histeresis", () => {
    expect(jalankan(zona)).toBeGreaterThanOrEqual(0.85);
  });

  it("orang lewat di lorong tidak membuat meja terisi", () => {
    for (const c of jawaban.filter((x) => x.lewat)) {
      const d = deteksi.find((x) => x.cuplikan === c.cuplikan)!.orang;
      for (const z of zona) if (c.status[z.id] === "kosong") expect(orangDiZona(d, z, 0.5), `${c.cuplikan} ${z.id}`).toBe(0);
    }
  });
});
