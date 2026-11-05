// Resep Mata (F5-01): mengubah deteksi objek per cuplikan menjadi status zona. Murni, tanpa model dan tanpa DOM, supaya bisa
// diuji dan dipakai sama persis di Web Worker, layar, dan skrip uji akurasi. Koordinat dinormalisasi 0..1. Rancangan:
// docs/research/mata.md.

export type Titik = [number, number];
export type Kotak = { xmin: number; ymin: number; xmax: number; ymax: number };
export type Deteksi = { label: string; score: number; box: Kotak };
/** meja dan antrean/rak dipantau statusnya (F5-01); kasir, pintu, lorong, kerja dipakai hitung kunjungan Mata v2 (W-02). */
export type JenisZona = "meja" | "antrean" | "rak" | "kasir" | "pintu" | "lorong" | "kerja";
export type Zona = { id: string; nama: string; jenis: JenisZona; poligon: Titik[] };
export type StatusMeja = "kosong" | "terisi";
export type Status = { nilai: StatusMeja; berturut: number };

/** Titik jangkar orang: tengah mendatar, tiga perempat ke bawah kotak (kira-kira pinggang orang yang duduk di meja). */
export function jangkar(b: Kotak): Titik {
  return [(b.xmin + b.xmax) / 2, b.ymax - (b.ymax - b.ymin) / 4];
}

/** Uji titik dalam poligon dengan ray casting (berlaku juga untuk poligon cekung). */
export function dalamPoligon([x, y]: Titik, poligon: Titik[]): boolean {
  let dalam = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const [xi, yi] = poligon[i];
    const [xj, yj] = poligon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export function orangDiZona(deteksi: Deteksi[], zona: Zona, ambangSkor = 0.5): number {
  return deteksi.filter((d) => d.label === "person" && d.score >= ambangSkor && dalamPoligon(jangkar(d.box), zona.poligon)).length;
}

export function statusAwal(): Status {
  return { nilai: "kosong", berturut: 0 };
}

/** Histeresis: status berganti hanya setelah `masuk` cuplikan berturut-turut ada orang (atau `keluar` cuplikan tanpa orang). */
export function langkahStatus(s: Status, adaOrang: boolean, opsi = { masuk: 2, keluar: 3 }): { status: Status; berubah: boolean } {
  const menuju: StatusMeja = adaOrang ? "terisi" : "kosong";
  if (menuju === s.nilai) return { status: { nilai: s.nilai, berturut: 0 }, berubah: false };
  const berturut = s.berturut + 1;
  if (berturut >= (adaOrang ? opsi.masuk : opsi.keluar)) return { status: { nilai: menuju, berturut: 0 }, berubah: true };
  return { status: { nilai: s.nilai, berturut }, berubah: false };
}

/** Jumlah antrean = median beberapa cuplikan terakhir (dibulatkan), supaya satu cuplikan meleset tidak mengubah angka. */
export function medianAntrean(jumlah: number[]): number {
  if (!jumlah.length) return 0;
  const u = [...jumlah].sort((a, b) => a - b);
  const t = Math.floor(u.length / 2);
  return Math.round(u.length % 2 ? u[t] : (u[t - 1] + u[t]) / 2);
}

/** Bagian cuplikan yang statusnya sama dengan jawaban. */
export function akurasi(prediksi: StatusMeja[], jawaban: StatusMeja[]): number {
  if (prediksi.length !== jawaban.length || !jawaban.length) throw new Error("Panjang prediksi dan jawaban harus sama dan tidak kosong");
  return prediksi.filter((p, i) => p === jawaban[i]).length / jawaban.length;
}
