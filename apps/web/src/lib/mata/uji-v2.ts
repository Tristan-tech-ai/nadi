// Jalankan satu skenario sintetis lewat detektor + pelacak Mata v2 lalu ukur terhadap jawaban (W-02).

import { cocokkanKunjungan, deteksi, latarDari, OPSI_DETEKSI, OPSI_PELACAK, Pelacak, stabilkan, type Kunjungan, type OpsiDeteksi, type OpsiPelacak } from "./jejak.ts";
import { renderBingkai, type Skenario } from "./toko-sintetis.ts";

export type HasilUji = {
  nama: string;
  benar: number;
  hasil: number;
  /** 1 - |hasil - benar| / benar */
  akurasiJumlah: number;
  /** Rata-rata |lama hasil - lama benar| / lama benar pada kunjungan yang cocok. */
  galatLama: number;
  /** Bagian jawaban yang punya pasangan. */
  cocok: number;
  galatTunggu: number;
  galatLayan: number;
  kunjungan: Kunjungan[];
};

export function jalankanSkenario(s: Skenario, opsi: { deteksi?: OpsiDeteksi; pelacak?: OpsiPelacak } = {}): HasilUji {
  const n = Math.round(s.durasi * s.fps);
  const latar = latarDari(renderBingkai(s, 0));
  const p = new Pelacak(s.zona, opsi.pelacak ?? OPSI_PELACAK);
  const kunjungan: Kunjungan[] = [];
  for (let i = 1; i < n; i++) kunjungan.push(...p.langkah(i / s.fps, deteksi(latar, stabilkan(latar, renderBingkai(s, i)), opsi.deteksi ?? OPSI_DETEKSI)));
  kunjungan.push(...p.selesai());
  kunjungan.sort((a, b) => a.mulai - b.mulai);
  const jawab = s.jawaban;
  const cocok = cocokkanKunjungan(kunjungan, jawab);
  const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);
  const galatLama = rata(cocok.map(({ p: pi, j }) => Math.abs(kunjungan[pi].lama - jawab[j].lama) / jawab[j].lama));
  // Galat tunggu/layan dihitung pada total semua kunjungan yang cocok (banyak pelanggan tidak antre; nol membuat rasio per orang tidak bermakna).
  const total = (f: (i: number) => number) => cocok.reduce((a, c) => a + f(c.j), 0);
  const tB = total((j) => jawab[j].tunggu);
  const lB = total((j) => jawab[j].layan);
  const tH = cocok.reduce((a, c) => a + kunjungan[c.p].tunggu, 0);
  const lH = cocok.reduce((a, c) => a + kunjungan[c.p].layan, 0);
  return {
    nama: s.nama,
    benar: jawab.length,
    hasil: kunjungan.length,
    akurasiJumlah: 1 - Math.abs(kunjungan.length - jawab.length) / jawab.length,
    galatLama,
    cocok: cocok.length / jawab.length,
    galatTunggu: tB ? Math.abs(tH - tB) / tB : 0,
    galatLayan: lB ? Math.abs(lH - lB) / lB : 0,
    kunjungan,
  };
}
