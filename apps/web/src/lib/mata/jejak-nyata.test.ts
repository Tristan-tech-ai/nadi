import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deteksi, latarMedianStabil, OPSI_DETEKSI, OPSI_DETEKSI_PEKA, OPSI_PELACAK, Pelacak, stabilkan, type Bingkai, type ZonaV2 } from "./jejak";

// V-04/V-12: Mata pada footage CCTV ASLI (Pexels 37706044, kamera atas lorong mal; fixtures/korpus/mata-nyata/jawaban.json).
// Jalur sama dengan layar Mata: latar median stabil, stabilisasi per bingkai, kepekaan tinggi. Hitungan tangan: masuk 2-3,
// keluar 4-5. Pelacak keluar 6: dua orang yang berjalan berdempetan kadang pecah menjadi dua jejak (batas yang dicatat).
const AKAR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "mata-nyata");
const J = JSON.parse(readFileSync(join(AKAR, "jawaban.json"), "utf8"));
const kotak = (k: number[]): [number, number][] => [[k[0], k[1]], [k[2], k[1]], [k[2], k[3]], [k[0], k[3]]];
const ZONA: ZonaV2[] = J.zona.map((z: { id: string; nama: string; jenis: ZonaV2["jenis"]; k: number[] }) => ({ id: z.id, nama: z.nama, jenis: z.jenis, poligon: kotak(z.k) }));
const buf = readFileSync(join(AKAR, "pasar-bawah-160x90-5fps.gray"));
const n = buf.length / (J.lebar * J.tinggi);
const bingkai: Bingkai[] = Array.from({ length: n }, (_, i) => ({ lebar: J.lebar, tinggi: J.tinggi, data: new Uint8Array(buf.buffer, buf.byteOffset + i * J.lebar * J.tinggi, J.lebar * J.tinggi) }));

function jalankan(opsi: typeof OPSI_DETEKSI, stabil: boolean) {
  const contoh = Array.from({ length: 15 }, (_, k) => bingkai[Math.floor(((k + 0.5) / 15) * n)]);
  const latar = latarMedianStabil(contoh);
  const p = new Pelacak(ZONA, OPSI_PELACAK);
  let gumpal = 0;
  for (let i = 0; i < n; i++) {
    const g = deteksi(latar, stabil ? stabilkan(latar, bingkai[i]) : bingkai[i], opsi);
    gumpal += g.length;
    p.langkah(i / J.fps, g);
  }
  return { pintu: p.pintu, gumpal: gumpal / n };
}

describe("Mata pada footage CCTV asli", () => {
  test("kepekaan tinggi + stabilisasi: hitungan pintu dekat hitungan tangan", () => {
    const h = jalankan(OPSI_DETEKSI_PEKA, true);
    expect(h.pintu.masuk).toBeGreaterThanOrEqual(J.hitung_tangan.masuk[0]);
    expect(h.pintu.masuk).toBeLessThanOrEqual(J.hitung_tangan.masuk[1] + 1);
    expect(h.pintu.keluar).toBeGreaterThanOrEqual(J.hitung_tangan.keluar[0]);
    expect(h.pintu.keluar).toBeLessThanOrEqual(J.hitung_tangan.keluar[1] + 1);
  });
  test("setelan bawaan nyaris buta pada footage berkontras rendah ini (alasan ada pilihan kepekaan)", () => {
    expect(jalankan(OPSI_DETEKSI, true).gumpal).toBeLessThan(1.5);
    expect(jalankan(OPSI_DETEKSI_PEKA, true).gumpal).toBeGreaterThan(2);
  });
});
