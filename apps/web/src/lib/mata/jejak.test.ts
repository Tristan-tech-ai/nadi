import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { gumpalDari, Pelacak, rekapJam, teksJalur, tugaskan, type ZonaV2 } from "./jejak";
import { buatSkenario, KORPUS_V2, VIDEO_V2, type Skenario } from "./toko-sintetis";
import { jalankanSkenario } from "./uji-v2";

// W-02 Mata v2: kriteria terima diukur pada korpus toko sintetis berjalur diketahui (fixtures/korpus/mata-v2).
const AKAR = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "mata-v2");
const baca = (nama: string) => JSON.parse(readFileSync(join(AKAR, `${nama}.json`), "utf8")) as Skenario;

describe("korpus mata-v2", () => {
  test("berkas korpus sama dengan pembangkit (deterministik)", () => {
    for (const p of [...KORPUS_V2, VIDEO_V2]) expect(baca(p.nama)).toEqual(JSON.parse(JSON.stringify(buatSkenario(p))));
  });

  const hasil = KORPUS_V2.map((p) => p.nama);
  test.each(hasil)("skenario %s: jumlah kunjungan >= 90%%, galat lama <= 15%%", (nama) => {
    const h = jalankanSkenario(baca(nama));
    console.log(`${nama}: ${h.hasil}/${h.benar} kunjungan, akurasi ${(h.akurasiJumlah * 100).toFixed(1)}%, galat lama ${(h.galatLama * 100).toFixed(1)}%, tunggu ${(h.galatTunggu * 100).toFixed(1)}%, layan ${(h.galatLayan * 100).toFixed(1)}%`);
    expect(h.akurasiJumlah).toBeGreaterThanOrEqual(0.9);
    expect(h.galatLama).toBeLessThanOrEqual(0.15);
    expect(h.cocok).toBeGreaterThanOrEqual(0.8);
    expect(h.galatTunggu).toBeLessThanOrEqual(0.25);
  }, 120_000);

  test("gerbang bisa merah: tanpa zona pintu (sambung dan neraca pintu mati) skenario ramai jatuh di bawah 90%", () => {
    const s = baca("ramai");
    const h = jalankanSkenario({ ...s, zona: s.zona.filter((z) => z.jenis !== "pintu") });
    expect(h.akurasiJumlah).toBeLessThan(0.9);
  }, 120_000);
});

describe("bagian pelacak", () => {
  test("dua orang berdempetan dipecah menjadi dua gumpal", () => {
    const W = 40;
    const H = 20;
    const t = new Int8Array(W * H);
    for (let y = 5; y < 15; y++) for (let x = 5; x < 30; x++) t[y * W + x] = -1;
    const g = gumpalDari(t, W, H, { ambang: 30, luasMin: 0.01, luasOrang: 0.15 });
    expect(g).toHaveLength(2);
    expect(g[0].x).toBeLessThan(g[1].x);
    expect(g.every((x) => x.kutub === -1)).toBe(true);
  });

  test("penugasan optimal tidak menukar dua orang yang berpapasan (rakus menukar)", () => {
    // Jejak 0 dekat gumpal 1 (0,01) dan gumpal 0 (0,02); jejak 1 hanya bisa ke gumpal 1 (0,03). Rakus: 0-1, 1 tanpa pasangan.
    const p = [{ j: 0, g: 1, d: 0.01 }, { j: 0, g: 0, d: 0.02 }, { j: 1, g: 1, d: 0.03 }];
    expect(tugaskan(p, 2, 2).sort((a, b) => a.j - b.j)).toEqual([{ j: 0, g: 0 }, { j: 1, g: 1 }]);
  });

  test("karyawan di pos kerja tidak dihitung sebagai kunjungan; pelanggan dihitung dengan lama dan jalurnya", () => {
    const zona: ZonaV2[] = [
      { id: "p", nama: "Pintu", jenis: "pintu", poligon: [[0, 0.8], [0.3, 0.8], [0.3, 1], [0, 1]] },
      { id: "k", nama: "Kasir", jenis: "kasir", poligon: [[0.6, 0], [1, 0], [1, 0.3], [0.6, 0.3]] },
      { id: "w", nama: "Gudang", jenis: "kerja", poligon: [[0, 0], [0.3, 0], [0.3, 0.3], [0, 0.3]] },
    ];
    const p = new Pelacak(zona);
    const keluar = [];
    for (let i = 0; i <= 300; i++) {
      const t = i / 5;
      const g = [{ x: 0.15, y: 0.15 }];
      // Pelanggan: masuk di pintu, berjalan ke kasir (sampai detik 20), dilayani, kembali ke pintu (detik 40).
      if (t <= 40) {
        const f = t <= 20 ? t / 20 : t <= 30 ? 1 : 1 - (t - 30) / 10;
        g.push({ x: 0.15 + f * 0.65, y: 0.9 - f * 0.75 });
      }
      keluar.push(...p.langkah(t, g));
    }
    keluar.push(...p.selesai());
    expect(keluar).toHaveLength(1);
    expect(keluar[0].lama).toBeCloseTo(40, 0);
    expect(keluar[0].layan).toBeGreaterThan(8);
    expect(keluar[0].urutan).toEqual(["Pintu", "Kasir", "Pintu"]);
  });

  test("rekap per jam menjumlah kunjungan, tunggu, layan, detik zona, dan jalur", () => {
    const asal = Date.parse("2026-11-05T01:50:00Z");
    const r = rekapJam(
      [
        { mulai: 0, selesai: 300, lama: 300, urutan: ["Pintu", "Antrean", "Kasir"], zonaDetik: { a: 120, k: 60 }, tunggu: 120, layan: 60 },
        { mulai: 700, selesai: 760, lama: 60, urutan: ["Pintu"], zonaDetik: { a: 0.5 }, tunggu: 0, layan: 0 },
      ],
      asal,
    );
    expect(r.map((x) => x.jam)).toEqual(["2026-11-05T01:00:00.000Z", "2026-11-05T02:00:00.000Z"]);
    expect(r[0]).toMatchObject({ kunjungan: 1, lamaDetik: 300, tungguN: 1, tungguDetik: 120, layanN: 1, layanDetik: 60, zona: { a: { lintas: 1, detik: 120 }, k: { lintas: 1, detik: 60 } } });
    expect(r[1].zona).toEqual({});
    expect(r[0].jalur).toEqual({ "Pintu > Antrean > Kasir": 1 });
    expect(teksJalur(["a", "b", "c", "d", "e", "f", "g"])).toBe("a > b > c > d > e > f");
  });
});

describe("teks dan bingkai", () => {
  test("formatDurasi", async () => {
    const { formatDurasi } = await import("./jejak");
    expect(formatDurasi(250)).toBe("4 mnt 10 dtk");
    expect(formatDurasi(42)).toBe("42 dtk");
    expect(formatDurasi(120, "en")).toBe("2 min");
  });
  test("abuDari memakai luma", async () => {
    const { abuDari } = await import("./jejak");
    const b = abuDari(new Uint8ClampedArray([255, 255, 255, 255, 255, 0, 0, 255]), 2, 1);
    expect([...b.data]).toEqual([255, 76]);
  });
});

test("latarMedian membuang orang yang lewat", async () => {
  const { latarMedian } = await import("./jejak");
  const b = (v: number[]) => ({ lebar: 2, tinggi: 1, data: Uint8Array.from(v) });
  expect([...latarMedian([b([150, 150]), b([40, 150]), b([150, 40]), b([150, 150]), b([40, 150])])]).toEqual([150, 150]);
});

test("kamera miring: kotak model menjadi titik kaki dan dilacak sebagai satu kunjungan lewat pintu", async () => {
  const { titikDariKotak, Pelacak, OPSI_PELACAK_MIRING } = await import("./jejak");
  const zona = [{ id: "p", nama: "Pintu", jenis: "pintu" as const, poligon: [[0, 0.7], [0.3, 0.7], [0.3, 1], [0, 1]] as [number, number][] }];
  expect(titikDariKotak([{ label: "person", score: 0.9, box: { xmin: 0.1, ymin: 0.2, xmax: 0.3, ymax: 0.8 } }, { label: "person", score: 0.3, box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 } }, { label: "chair", score: 0.9, box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 } }]))
    .toEqual([{ x: 0.2, y: 0.77 }]);
  const p = new Pelacak(zona, OPSI_PELACAK_MIRING);
  const k = [];
  for (let i = 0; i <= 40; i++) {
    // 2 bingkai per detik: masuk di pintu, berjalan ke kanan atas, kembali ke pintu.
    const f = i <= 20 ? i / 20 : (40 - i) / 20;
    const kotak = { xmin: 0.05 + 0.5 * f, ymin: 0.4 - 0.3 * f, xmax: 0.2 + 0.5 * f, ymax: 0.95 - 0.3 * f };
    k.push(...p.langkah(i / 2, titikDariKotak([{ label: "person", score: 0.8, box: kotak }])));
  }
  k.push(...p.selesai());
  expect(k).toHaveLength(1);
  expect(k[0].lama).toBeCloseTo(20, 0);
});
