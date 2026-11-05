import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deteksi, LatarHidup, OPSI_DETEKSI, OPSI_PELACAK, Pelacak, stabilkan, type Bingkai } from "./jejak";
import { renderBingkai, type Skenario } from "./toko-sintetis";

// W-10A: sumber langsung (kamera, CCTV lewat jembatan) mulai di tengah keramaian. Latar median bergulir harus menghitung kunjungan
// korpus pendek (5 pelanggan, dua sudah di dalam saat kamera mulai) dari titik mulai mana pun, pada 5 bingkai per detik.
const AKAR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "mata-v2");
const S = JSON.parse(readFileSync(join(AKAR, "pendek.json"), "utf8")) as Skenario & { jawaban: unknown[] };
const n = Math.round(S.durasi * S.fps);
const B: Bingkai[] = Array.from({ length: n }, (_, i) => renderBingkai(S, i));
const di = (t: number) => B[Math.min(n - 1, Math.max(0, Math.round(t * S.fps)))];

function hitung(mulai: number) {
  const lh = new LatarHidup();
  const p = new Pelacak(S.zona, OPSI_PELACAK);
  let h = 0;
  let siapPada = -1;
  for (let t = 0; t < S.durasi + 10 - mulai; t += 0.2) {
    const siap = lh.tambah(t, di(mulai + t));
    if (siap.length > 1) siapPada = t;
    for (const x of siap) h += p.langkah(x.t, deteksi(lh.latar!, stabilkan(lh.latar!, x.b), OPSI_DETEKSI)).length;
  }
  return { n: h + p.selesai().length, siapPada };
}

describe("latar hidup", () => {
  test("pemanasan 30 dtk lalu semua bingkai tampungan dideteksi", () => {
    const lh = new LatarHidup();
    expect(lh.tambah(0, B[0])).toEqual([]);
    expect(lh.sisa(10)).toBe(20);
    for (let t = 0.2; t < 29.9; t += 0.2) expect(lh.tambah(t, B[0])).toEqual([]);
    expect(lh.tambah(30, B[0]).length).toBeGreaterThan(140);
    expect(lh.latar).not.toBeNull();
    expect(lh.tambah(30.2, B[0])).toHaveLength(1);
  });
  test("dihentikan saat pemanasan: tampungan tetap dihitung", () => {
    const lh = new LatarHidup();
    lh.tambah(0, B[0]);
    lh.tambah(0.2, B[1]);
    expect(lh.paksa()).toHaveLength(2);
    expect(lh.paksa()).toEqual([]);
  });
  test.each([0, 1, 3])("kamera mulai di detik %i: kunjungan sama dengan jawaban", (mulai) => {
    const h = hitung(mulai);
    expect(h.siapPada).toBeGreaterThanOrEqual(30);
    expect(h.n).toBe(S.jawaban.length);
  });
});
