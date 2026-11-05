import { describe, expect, it } from "vitest";
import { Pelacak, type ZonaV2 } from "@/lib/mata/jejak";

// V-12: tampilan pelacakan di perangkat. Nomor anonim per sesi, garis 3 detik terakhir, hitungan pintu, zona terisi.
const kotak = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ZONA: ZonaV2[] = [
  { id: "pintu", nama: "Pintu", jenis: "pintu", poligon: kotak(0.4, 0.85, 0.6, 1) },
  { id: "kasir", nama: "Kasir", jenis: "kasir", poligon: kotak(0.7, 0.4, 0.9, 0.6) },
];

/** Satu orang: masuk dari pintu (0,5; 0,95), ke kasir (0,8; 0,5), diam 2 dtk, kembali ke pintu. 5 bingkai per detik. */
function jalan(p: Pelacak, mulai = 0, geser = 0) {
  const titik: [number, number][] = [];
  for (let i = 0; i <= 20; i++) titik.push([0.5 + geser + (0.3 * i) / 20, 0.95 - (0.45 * i) / 20]);
  for (let i = 0; i < 10; i++) titik.push([0.8 + geser, 0.5]);
  for (let i = 20; i >= 0; i--) titik.push([0.5 + geser + (0.3 * i) / 20, 0.95 - (0.45 * i) / 20]);
  return titik.map(([x, y], k) => ({ t: mulai + k / 5, x, y }));
}

describe("tampilan pelacakan Mata (V-12)", () => {
  it("satu orang: nomor 1, masuk 1 lalu keluar 1, garis paling lama 3 detik, zona kasir menyala saat ia di kasir", () => {
    const p = new Pelacak(ZONA);
    let kasirMenyala = false;
    let garisTerpanjang = 0;
    for (const s of jalan(p)) {
      p.langkah(s.t, [{ x: s.x, y: s.y }]);
      const t = p.tampil;
      expect(t.map((x) => x.nomor)).toEqual([1]);
      garisTerpanjang = Math.max(garisTerpanjang, t[0].garis.length);
      if (p.zonaTerisi.has("kasir")) kasirMenyala = true;
    }
    expect(kasirMenyala).toBe(true);
    expect(garisTerpanjang).toBeLessThanOrEqual(3 * 5 + 1);
    expect(p.pintu).toEqual({ masuk: 1, keluar: 1 });
  });

  it("dua orang berurutan mendapat nomor berbeda dan hitungan pintu menjumlah keduanya", () => {
    const p = new Pelacak(ZONA);
    const a = jalan(p, 0), b = jalan(p, 4, -0.05);
    const waktu = [...new Set([...a, ...b].map((x) => x.t))].sort((x, y) => x - y);
    const nomor = new Set<number>();
    for (const t of waktu) {
      const g = [...a, ...b].filter((x) => Math.abs(x.t - t) < 1e-9).map((x) => ({ x: x.x, y: x.y }));
      p.langkah(t, g);
      for (const j of p.tampil) nomor.add(j.nomor);
    }
    expect([...nomor].sort()).toEqual([1, 2]);
    expect(p.pintu).toEqual({ masuk: 2, keluar: 2 });
  });

  it("orang keluar lalu orang lain langsung masuk di pintu yang sama: dihitung masuk lagi dengan nomor baru", () => {
    const p = new Pelacak(ZONA);
    const a = jalan(p);
    for (const s of a) p.langkah(s.t, [{ x: s.x, y: s.y }]);
    // Orang kedua muncul di titik pintu yang sama tepat setelah orang pertama sampai di pintu, lalu berjalan ke dalam.
    const akhir = a[a.length - 1].t;
    for (let i = 1; i <= 15; i++) p.langkah(akhir + i / 5, [{ x: 0.5, y: 0.95 - 0.02 * i }]);
    expect(p.pintu.masuk).toBe(2);
    expect(p.tampil[0].nomor).toBe(2);
    expect(p.tampil[0].garis.length).toBeLessThanOrEqual(16);
  });

  it("nomor dan garis tidak ikut ke kunjungan yang dikirim", () => {
    const p = new Pelacak(ZONA);
    for (const s of jalan(p)) p.langkah(s.t, [{ x: s.x, y: s.y }]);
    const k = p.selesai();
    expect(k).toHaveLength(1);
    expect(Object.keys(k[0])).not.toContain("nomor");
    expect(JSON.stringify(k)).not.toMatch(/garis|riwayat|nomor/);
  });
});
