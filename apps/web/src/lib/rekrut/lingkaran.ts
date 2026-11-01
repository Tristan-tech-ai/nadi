// Lingkaran belajar rekrutmen (F2-07, docs/research/lingkaran-rekrut.md): seberapa searah nilai seleksi (per pertanyaan wawancara,
// uji kerja hitungan) dengan kinerja bulan ke-3 sampai ke-6 (poin selesai per minggu, persen tepat waktu). Korelasi peringkat
// Spearman; n < 10 tanpa angka, 10 sampai 29 bertanda petunjuk awal. Hanya agregat, tanpa nama.
import { buatUji, nilaiUji } from "./uji-kerja";

export type BarisLingkaran = {
  lamaran: string;
  minggu: number;
  poinPerMinggu: number;
  persenTepat: number | null;
  wawancara: { pertanyaan: string; skor: number | null }[];
  uji: { topiKode: string; benih: number; jawaban: string[] } | null;
};
export type Ukuran = "poin" | "tepat";
export type Tingkat = "belum_cukup" | "awal" | "cukup";
export type HasilSinyal = { sinyal: string; ukuran: Ukuran; n: number; r: number | null; tingkat: Tingkat; kalimat: string };

export const MIN_SAMPEL = 10;
export const SAMPEL_CUKUP = 30;
export const SINYAL_UJI = "Uji kerja hitungan";
const NAMA_UKURAN: Record<Ukuran, string> = { poin: "poin selesai per minggu", tepat: "persen kerja tepat waktu" };

/** Peringkat mulai 1, nilai sama mendapat peringkat rata-rata. */
export function peringkat(xs: number[]): number[] {
  const urut = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const hasil = new Array<number>(xs.length);
  for (let a = 0; a < urut.length; ) {
    let b = a;
    while (b + 1 < urut.length && urut[b + 1].v === urut[a].v) b++;
    for (let k = a; k <= b; k++) hasil[urut[k].i] = (a + b) / 2 + 1;
    a = b + 1;
  }
  return hasil;
}

/** Korelasi peringkat Spearman (Pearson atas peringkat); null bila kurang dari 3 pasang atau salah satu tanpa variasi. */
export function spearman(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const rx = peringkat(x);
  const ry = peringkat(y);
  const mx = rx.reduce((s, v) => s + v, 0) / rx.length;
  const my = ry.reduce((s, v) => s + v, 0) / ry.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < rx.length; i++) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

function skorUji(u: NonNullable<BarisLingkaran["uji"]>): number | null {
  const soal = buatUji(u.topiKode, u.benih);
  if (!soal) return null;
  const n = nilaiUji(soal, u.jawaban);
  return n.dari ? (100 * n.benar) / n.dari : null;
}

const desimal = (r: number) => r.toFixed(2).replace(".", ",");

function kalimat(sinyal: string, ukuran: Ukuran, n: number, r: number | null, tingkat: Tingkat): string {
  if (tingkat === "belum_cukup") return `Belum cukup data: ${n} orang, butuh minimal ${MIN_SAMPEL} orang yang sudah bekerja 3 bulan.`;
  if (r === null) return `Nilai ${n} orang sama semua, jadi belum bisa dibandingkan.`;
  const a = Math.abs(r);
  const kekuatan = a < 0.2 ? "hampir tidak berhubungan" : a < 0.4 ? "berhubungan lemah" : a < 0.6 ? "berhubungan sedang" : "berhubungan kuat";
  const arah = a < 0.2 ? "" : r > 0 ? ` Nilai tinggi di sini cenderung diikuti ${NAMA_UKURAN[ukuran]} yang lebih tinggi.` : ` Nilai tinggi di sini justru cenderung diikuti ${NAMA_UKURAN[ukuran]} yang lebih rendah.`;
  const awal = tingkat === "awal" ? " Sampel kecil: anggap petunjuk awal, bukan kepastian." : "";
  return `${sinyal}: ${kekuatan} dengan ${NAMA_UKURAN[ukuran]} (Spearman ${desimal(r)}, ${n} orang).${arah}${awal}`;
}

export function laporanLingkaran(baris: BarisLingkaran[]): { orang: number; sinyal: HasilSinyal[] } {
  // Nilai per sinyal per lamaran: pertanyaan wawancara (rata-rata bila diulang) dan uji kerja.
  const nilai = new Map<string, Map<string, number>>();
  const catat = (sinyal: string, lamaran: string, v: number | null) => {
    if (v === null || !Number.isFinite(v)) return;
    if (!nilai.has(sinyal)) nilai.set(sinyal, new Map());
    nilai.get(sinyal)!.set(lamaran, v);
  };
  for (const b of baris) {
    for (const w of b.wawancara) catat(w.pertanyaan.trim(), b.lamaran, w.skor);
    if (b.uji) catat(SINYAL_UJI, b.lamaran, skorUji(b.uji));
  }
  const perLamaran = new Map(baris.map((b) => [b.lamaran, b]));
  const sinyal: HasilSinyal[] = [];
  for (const [nama, peta] of nilai) {
    for (const ukuran of ["poin", "tepat"] as Ukuran[]) {
      const pasang = [...peta].map(([l, x]) => [x, ukuran === "poin" ? perLamaran.get(l)!.poinPerMinggu : perLamaran.get(l)!.persenTepat] as const)
        .filter((p): p is readonly [number, number] => p[1] !== null);
      const n = pasang.length;
      const tingkat: Tingkat = n < MIN_SAMPEL ? "belum_cukup" : n < SAMPEL_CUKUP ? "awal" : "cukup";
      const r = tingkat === "belum_cukup" ? null : spearman(pasang.map((p) => p[0]), pasang.map((p) => p[1]));
      sinyal.push({ sinyal: nama, ukuran, n, r, tingkat, kalimat: kalimat(nama, ukuran, n, r, tingkat) });
    }
  }
  return { orang: baris.length, sinyal };
}
