import { describe, expect, test } from "vitest";
import { deteksi, latarDari, latarMedianStabil, OPSI_DETEKSI_PEKA, stabilkan, type Bingkai } from "./jejak";

// V-12 (6 Nov 2026): footage CCTV asli bergeser 3 px dan meredup 4% dalam 12 dtk; tanpa stabilisasi beda latar menyala di tepi
// benda (gumpal palsu). Lantai bertekstur kotak-kotak acak berbenih supaya geseran bisa diukur.
const W = 160, H = 120;
function lantai(): Uint8Array {
  const d = new Uint8Array(W * H);
  let s = 7;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x % 8 === 0 && y % 8 === 0) s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[y * W + x] = 60 + (((Math.floor(x / 8) * 31 + Math.floor(y / 8) * 17 + (s % 3)) * 37) % 120);
  }
  return d;
}
const L = lantai();
function geser(dx: number, dy: number, gain = 1, orang?: [number, number]): Bingkai {
  const d = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(W - 1, Math.max(0, x - dx)), sy = Math.min(H - 1, Math.max(0, y - dy));
    d[y * W + x] = Math.min(255, Math.round(L[sy * W + sx] * gain));
  }
  if (orang) for (let y = orang[1] - 2; y <= orang[1] + 2; y++) for (let x = orang[0] - 2; x <= orang[0] + 2; x++) d[y * W + x] = 15;
  return { lebar: W, tinggi: H, data: d };
}

describe("stabilisasi beda latar", () => {
  const latar = latarDari({ lebar: W, tinggi: H, data: L });
  test("kamera bergeser 3 px dan meredup 4%: tanpa stabilisasi banyak gumpal palsu, dengan stabilisasi nol", () => {
    const b = geser(3, -2, 0.96);
    expect(deteksi(latar, b, OPSI_DETEKSI_PEKA).length).toBeGreaterThan(3);
    expect(deteksi(latar, stabilkan(latar, b), OPSI_DETEKSI_PEKA)).toHaveLength(0);
  });
  test("orang yang lewat tetap terdeteksi tepat satu kali di posisinya setelah distabilkan", () => {
    const b = geser(2, 1, 0.97, [80, 60]);
    const g = deteksi(latar, stabilkan(latar, b), OPSI_DETEKSI_PEKA);
    expect(g).toHaveLength(1);
    expect(Math.abs(g[0].x * W - 78)).toBeLessThan(3);
    expect(Math.abs(g[0].y * H - 59)).toBeLessThan(3);
  });
  test("latar median dari rekaman yang bergeser tetap tajam (selaras ke median geseran, 1 px)", () => {
    const contoh = [0, 1, 2, 3, 2, 1, 0].map((k) => geser(k, 0));
    const lt = latarMedianStabil(contoh);
    const acuan = geser(1, 0).data;
    let beda = 0;
    for (let i = 0; i < W * H; i++) if (Math.abs(lt[i] - acuan[i]) > 30) beda++;
    expect(beda / (W * H)).toBeLessThan(0.05);
  });
});
