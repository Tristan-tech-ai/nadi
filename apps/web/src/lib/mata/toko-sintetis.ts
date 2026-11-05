// Korpus video toko sintetis untuk Mata v2 (W-02): skenario dengan jalur tiap orang diketahui, lalu dirender menjadi bingkai
// abu-abu kamera atas. Deterministik dari benih, tanpa gambar orang sungguhan. Jawaban (kunjungan, lama, tunggu, layan) dihitung
// dari jalur yang sama, jadi akurasi pelacak bisa diukur jujur. Dipakai tes (src/lib/mata/jejak.test.ts) dan skrip korpus
// (scripts/korpus/mata-v2.ts) yang menulis fixtures/korpus/mata-v2.

import { dalamPoligon, type Titik } from "./resep.ts";
import type { Bingkai, ZonaV2 } from "./jejak.ts";

export type TitikWaktu = [number, number, number];
export type OrangSintetis = { karyawan?: boolean; terang: boolean; titik: TitikWaktu[] };
export type Kotak = [number, number, number, number];
export type JawabanKunjungan = { mulai: number; selesai: number; lama: number; tunggu: number; layan: number };
export type Skenario = {
  nama: string;
  lebar: number;
  tinggi: number;
  fps: number;
  durasi: number;
  benih: number;
  zona: ZonaV2[];
  rak: Kotak[];
  halangan: Kotak[];
  derau: { geser: number; hilang: number; palsu: number; cahaya: number };
  orang: OrangSintetis[];
  jawaban: JawabanKunjungan[];
};

export function acak(benih: number) {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kotakPoligon = ([x0, y0, x1, y1]: Kotak): Titik[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Denah toko contoh: pintu kiri bawah, dua lorong di antara rak, antrean dan kasir di kanan, pos kerja di balik meja kasir. */
export const DENAH: { zona: ZonaV2[]; rak: Kotak[]; halangan: Kotak[] } = {
  zona: [
    { id: "z-pintu", nama: "Pintu", jenis: "pintu", poligon: kotakPoligon([0.0, 0.84, 0.22, 1.0]) },
    { id: "z-lorong-a", nama: "Lorong A", jenis: "lorong", poligon: kotakPoligon([0.22, 0.08, 0.4, 0.76]) },
    { id: "z-lorong-b", nama: "Lorong B", jenis: "lorong", poligon: kotakPoligon([0.48, 0.08, 0.64, 0.76]) },
    { id: "z-antrean", nama: "Antrean", jenis: "antrean", poligon: [[0.78, 0.42], [0.94, 0.42], [0.94, 0.83], [0.3, 0.83], [0.3, 0.765], [0.78, 0.765]] },
    { id: "z-kasir", nama: "Kasir", jenis: "kasir", poligon: kotakPoligon([0.76, 0.2, 0.96, 0.4]) },
    { id: "z-kerja", nama: "Balik meja", jenis: "kerja", poligon: kotakPoligon([0.76, 0.0, 0.98, 0.15]) },
  ],
  rak: [[0.12, 0.08, 0.2, 0.74], [0.41, 0.08, 0.47, 0.74], [0.65, 0.08, 0.7, 0.74], [0.76, 0.16, 0.98, 0.19]],
  halangan: [[0.42, 0.8, 0.5, 0.9]],
};

const PINTU: [number, number] = [0.1, 0.99];
// Antrean lurus ke bawah lalu berbelok ke kiri di depan rak (tempat ke-5 dan seterusnya).
const ANTRE = (i: number): [number, number] => (i < 4 ? [0.86, 0.47 + 0.085 * i] : [0.86 - 0.072 * (i - 3), 0.79]);
const KASIR: [number, number] = [0.86, 0.3];

/** Bangun skenario: pelanggan datang acak, keliling lorong, sebagian antre di satu kasir (antrean nyata dari jadwal layanan). */
export function buatSkenario(p: { nama: string; benih: number; durasi: number; pelanggan: number; porsiKasir: number; derau: Skenario["derau"]; karyawan?: boolean }): Skenario {
  const r = acak(p.benih);
  const antara = (a: number, b: number) => a + r() * (b - a);
  const kec = 0.13;
  const orang: OrangSintetis[] = [];
  const datang = Array.from({ length: p.pelanggan }, () => antara(3, p.durasi - 140)).sort((a, b) => a - b);
  // Rencana tiap pelanggan: titik lorong lalu (mungkin) kasir. Waktu tiba di antrean dihitung dulu agar jadwal kasir bisa disusun.
  type Rencana = { titik: TitikWaktu[]; keKasir: boolean; tibaAntre: number; layan: number };
  const rencana: Rencana[] = datang.map((t0) => {
    const titik: TitikWaktu[] = [[t0, PINTU[0], PINTU[1]]];
    let t = t0;
    let [x, y] = PINTU;
    const jalan = (nx: number, ny: number) => {
      t += Math.hypot(nx - x, ny - y) / kec;
      x = nx;
      y = ny;
      titik.push([t, x, y]);
    };
    const diam = (d: number) => {
      t += d;
      titik.push([t, x, y]);
    };
    jalan(0.16, 0.9);
    const lorong = r() < 0.5 ? 0.31 : 0.56;
    jalan(lorong, 0.88);
    jalan(lorong, antara(0.2, 0.7));
    diam(antara(4, 30));
    if (r() < 0.5) {
      jalan(lorong, antara(0.15, 0.7));
      diam(antara(3, 20));
    }
    jalan(lorong, 0.88);
    const keKasir = r() < p.porsiKasir;
    if (keKasir) jalan(0.74, 0.88);
    return { titik, keKasir, tibaAntre: t, layan: antara(12, 35) };
  });
  // Satu kasir: layanan berurutan menurut waktu tiba di antrean.
  const kasirUrut = rencana.map((x, i) => ({ x, i })).filter((a) => a.x.keKasir).sort((a, b) => a.x.tibaAntre - b.x.tibaAntre);
  const mulaiLayan: number[] = [];
  let bebas = 0;
  for (const { x } of kasirUrut) {
    const s = Math.max(x.tibaAntre + 2.5, bebas);
    mulaiLayan.push(s);
    bebas = s + x.layan + 2;
  }
  kasirUrut.forEach(({ x }, k) => {
    const s = mulaiLayan[k];
    let t = x.tibaAntre;
    const posisi = (tau: number) => mulaiLayan.slice(0, k).filter((sj) => sj > tau).length;
    let spot = posisi(t + 2.5);
    let [px, py] = ANTRE(spot);
    t += 2.5;
    x.titik.push([t, px, py]);
    // Maju satu tempat setiap orang di depan mulai dilayani.
    for (const sj of mulaiLayan.slice(0, k).filter((sj) => sj > t && sj < s).sort((a, b) => a - b)) {
      x.titik.push([sj, px, py]);
      spot = Math.max(0, spot - 1);
      [px, py] = ANTRE(spot);
      x.titik.push([sj + 1.5, px, py]);
    }
    x.titik.push([s, px, py]);
    x.titik.push([s + 2, KASIR[0], KASIR[1]]);
    t = s + 2 + x.layan;
    x.titik.push([t, KASIR[0], KASIR[1]]);
    // Keluar lewat sisi kiri antrean (berpapasan dengan orang yang antre), lalu ke pintu.
    for (const [nx, ny] of [[0.73, 0.3], [0.73, 0.9], [0.16, 0.92], PINTU] as [number, number][]) {
      const [lx, ly] = x.titik[x.titik.length - 1].slice(1) as [number, number];
      t += Math.hypot(nx - lx, ny - ly) / kec;
      x.titik.push([t, nx, ny]);
    }
  });
  for (const x of rencana) {
    if (!x.keKasir) {
      let [lt, lx, ly] = x.titik[x.titik.length - 1];
      for (const [nx, ny] of [[0.16, 0.92], PINTU] as [number, number][]) {
        lt += Math.hypot(nx - lx, ny - ly) / kec;
        lx = nx;
        ly = ny;
        x.titik.push([lt, nx, ny]);
      }
    }
    orang.push({ terang: r() < 0.3, titik: x.titik.map(([t, a, b]) => [bulat(t), bulat(a, 4), bulat(b, 4)]) });
  }
  if (p.karyawan) {
    // Karyawan di balik meja sepanjang rekaman, sesekali mengisi rak di lorong B (tetap sebagian besar di pos kerja).
    const titik: TitikWaktu[] = [[0, 0.87, 0.07]];
    let t = 0;
    while (t < p.durasi - 1) {
      t = Math.min(p.durasi - 1, t + antara(20, 60));
      titik.push([bulat(t), bulat(antara(0.8, 0.94), 4), bulat(antara(0.04, 0.11), 4)]);
    }
    orang.push({ karyawan: true, terang: false, titik });
  }
  // Rekaman berjalan sampai pelanggan terakhir keluar, supaya jawaban tidak memuat waktu yang tidak terekam.
  const akhir = Math.max(p.durasi, ...orang.filter((o) => !o.karyawan).map((o) => Math.ceil(o.titik[o.titik.length - 1][0]) + 5));
  for (const o of orang) if (o.karyawan) o.titik.push([akhir, o.titik[o.titik.length - 1][1], o.titik[o.titik.length - 1][2]]);
  const s: Skenario = { nama: p.nama, lebar: 160, tinggi: 120, fps: 5, durasi: akhir, benih: p.benih, ...DENAH, derau: p.derau, orang, jawaban: [] };
  s.jawaban = jawabanDari(s);
  return s;
}

function bulat(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Posisi orang pada waktu t (interpolasi linear antartitik), null bila belum datang atau sudah pergi. */
export function posisi(o: OrangSintetis, t: number): [number, number] | null {
  const ts = o.titik;
  if (t < ts[0][0] || t > ts[ts.length - 1][0]) return null;
  for (let i = 1; i < ts.length; i++) {
    if (t <= ts[i][0]) {
      const [t0, x0, y0] = ts[i - 1];
      const [t1, x1, y1] = ts[i];
      const f = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
  }
  return [ts[ts.length - 1][1], ts[ts.length - 1][2]];
}

/** Jawaban per pelanggan (karyawan tidak dihitung): lama terlihat, detik di zona antrean dan kasir (sampel 1/fps). */
export function jawabanDari(s: Skenario): JawabanKunjungan[] {
  const antre = s.zona.filter((z) => z.jenis === "antrean");
  const kasir = s.zona.filter((z) => z.jenis === "kasir");
  return s.orang
    .filter((o) => !o.karyawan)
    .map((o) => {
      const mulai = o.titik[0][0];
      const selesai = o.titik[o.titik.length - 1][0];
      let tunggu = 0;
      let layan = 0;
      for (let t = mulai; t <= selesai; t += 1 / s.fps) {
        const p = posisi(o, t)!;
        if (antre.some((z) => dalamPoligon(p, z.poligon))) tunggu += 1 / s.fps;
        if (kasir.some((z) => dalamPoligon(p, z.poligon))) layan += 1 / s.fps;
      }
      return { mulai, selesai, lama: bulat(selesai - mulai, 1), tunggu: bulat(tunggu, 1), layan: bulat(layan, 1) };
    })
    .sort((a, b) => a.mulai - b.mulai);
}

/** Render bingkai ke-i: lantai bertegel, rak gelap, orang sebagai badan + kepala, derau piksel, cahaya bergeser, deteksi hilang. */
export function renderBingkai(s: Skenario, i: number, r = acak(s.benih * 7919 + i)): Bingkai {
  const { lebar: W, tinggi: H } = s;
  const t = i / s.fps;
  const data = new Uint8Array(W * H);
  const cahaya = s.derau.cahaya * Math.sin(t / 37) + (t > s.durasi * 0.6 ? s.derau.cahaya : 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = x % 16 === 0 || y % 16 === 0 ? 138 : 152;
      const nx = x / W;
      const ny = y / H;
      if (s.rak.some(([x0, y0, x1, y1]) => nx >= x0 && nx < x1 && ny >= y0 && ny < y1)) v = 96;
      data[y * W + x] = v;
    }
  const tulis = (cx: number, cy: number, rad: number, nilai: number) => {
    for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(H - 1, Math.ceil(cy + rad)); y++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(W - 1, Math.ceil(cx + rad)); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) data[y * W + x] = nilai;
  };
  for (const o of s.orang) {
    const p = posisi(o, t);
    if (!p) continue;
    if (r() < s.derau.hilang) continue;
    if (s.halangan.some(([x0, y0, x1, y1]) => p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1)) continue;
    const cx = (p[0] + (r() - 0.5) * s.derau.geser) * W;
    const cy = (p[1] + (r() - 0.5) * s.derau.geser) * H;
    tulis(cx, cy, 6, o.terang ? 228 : 58);
    tulis(cx, cy, 3, o.terang ? 205 : 32);
  }
  if (r() < s.derau.palsu) tulis(r() * W, r() * H, 4 + r() * 3, 70);
  for (let k = 0; k < data.length; k++) data[k] = Math.max(0, Math.min(255, Math.round(data[k] + cahaya + (r() - 0.5) * 10)));
  return { lebar: W, tinggi: H, data };
}

/** Skenario korpus (fixtures/korpus/mata-v2). Tiga pertama dipakai menyetel parameter; dua terakhir hanya untuk menguji. */
export const KORPUS_V2: Parameters<typeof buatSkenario>[0][] = [
  { nama: "sepi", benih: 11, durasi: 300, pelanggan: 10, porsiKasir: 0.6, derau: { geser: 0.006, hilang: 0.03, palsu: 0.01, cahaya: 3 } },
  { nama: "ramai", benih: 22, durasi: 900, pelanggan: 45, porsiKasir: 0.6, derau: { geser: 0.008, hilang: 0.08, palsu: 0.02, cahaya: 4 }, karyawan: true },
  { nama: "antrean", benih: 33, durasi: 600, pelanggan: 24, porsiKasir: 1, derau: { geser: 0.006, hilang: 0.05, palsu: 0.01, cahaya: 3 }, karyawan: true },
  { nama: "ramai-2", benih: 44, durasi: 900, pelanggan: 50, porsiKasir: 0.5, derau: { geser: 0.008, hilang: 0.08, palsu: 0.02, cahaya: 4 }, karyawan: true },
  { nama: "sepi-2", benih: 55, durasi: 400, pelanggan: 12, porsiKasir: 0.7, derau: { geser: 0.006, hilang: 0.04, palsu: 0.01, cahaya: 3 } },
];
/** Skenario pendek untuk video e2e (layar Mata di peramban). */
export const VIDEO_V2: Parameters<typeof buatSkenario>[0] = { nama: "pendek", benih: 66, durasi: 60, pelanggan: 5, porsiKasir: 0.6, derau: { geser: 0.006, hilang: 0.03, palsu: 0.01, cahaya: 2 } };
