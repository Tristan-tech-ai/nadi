// Word Error Rate untuk mengukur transkrip wawancara suara (F2-03, docs/research/wawancara.md).
// WER = (substitusi + hapus + sisip) / jumlah kata rujukan, setelah kedua teks dinormalisasi dengan cara yang sama.

export type HasilWer = { wer: number; substitusi: number; hapus: number; sisip: number; kata: number };

/** Huruf kecil, tanda baca dibuang (tanda hubung kata ulang dipertahankan sebagai satu kata), spasi dirapikan. */
export function normalisasi(teks: string): string[] {
  return teks
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[“”"'’‘`]/g, "")
    .replace(/(\p{L})-(\p{L})/gu, "$1-$2")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/(^|\s)-+|-+(\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Jarak Levenshtein tingkat kata dengan rincian jenis kesalahan. */
export function wer(rujukan: string, hipotesis: string): HasilWer {
  const r = normalisasi(rujukan);
  const h = normalisasi(hipotesis);
  // biaya[i][j] = [total, sub, hapus, sisip] untuk r[0..i) vs h[0..j)
  let sebelum: [number, number, number, number][] = Array.from({ length: h.length + 1 }, (_, j) => [j, 0, 0, j]);
  for (let i = 1; i <= r.length; i++) {
    const kini: [number, number, number, number][] = [[i, 0, i, 0]];
    for (let j = 1; j <= h.length; j++) {
      if (r[i - 1] === h[j - 1]) {
        kini.push(sebelum[j - 1]);
        continue;
      }
      const sub = sebelum[j - 1];
      const hps = sebelum[j];
      const ssp = kini[j - 1];
      const min = Math.min(sub[0], hps[0], ssp[0]);
      if (sub[0] === min) kini.push([sub[0] + 1, sub[1] + 1, sub[2], sub[3]]);
      else if (hps[0] === min) kini.push([hps[0] + 1, hps[1], hps[2] + 1, hps[3]]);
      else kini.push([ssp[0] + 1, ssp[1], ssp[2], ssp[3] + 1]);
    }
    sebelum = kini;
  }
  const [total, substitusi, hapus, sisip] = sebelum[h.length];
  return { wer: r.length ? total / r.length : h.length ? 1 : 0, substitusi, hapus, sisip, kata: r.length };
}

/** WER korpus: jumlah semua kesalahan dibagi jumlah semua kata rujukan (bukan rata-rata per klip). */
export function werKorpus(pasangan: { rujukan: string; hipotesis: string }[]): HasilWer {
  const t = pasangan.map((p) => wer(p.rujukan, p.hipotesis)).reduce(
    (a, b) => ({ wer: 0, substitusi: a.substitusi + b.substitusi, hapus: a.hapus + b.hapus, sisip: a.sisip + b.sisip, kata: a.kata + b.kata }),
    { wer: 0, substitusi: 0, hapus: 0, sisip: 0, kata: 0 },
  );
  return { ...t, wer: t.kata ? (t.substitusi + t.hapus + t.sisip) / t.kata : 0 };
}
