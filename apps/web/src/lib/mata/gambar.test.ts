import { describe, expect, test } from "vitest";
import { gambarMata, isiZona, type Kuas } from "./gambar";

// V-12: lapisan pelacakan yang dirancang ulang. Kuas palsu mencatat teks dan garis putus supaya isi lapisan bisa diperiksa.
function kuasPalsu() {
  const teks: string[] = [];
  const putus: number[][] = [];
  const g = {
    globalAlpha: 1, lineWidth: 1, strokeStyle: "", fillStyle: "", font: "", textAlign: "left", textBaseline: "alphabetic", lineCap: "butt", lineJoin: "miter",
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {}, fillRect() {}, arc() {}, roundRect() {},
    setLineDash(d: number[]) { putus.push(d); },
    fillText(t: string) { teks.push(t); },
    measureText(t: string) { return { width: t.length * 7 } as TextMetrics; },
  } as unknown as Kuas;
  return { g, teks, putus };
}
const ZONA = [
  { id: "lr", nama: "Lorong kanan", jenis: "lorong", poligon: [[0.69, 0.1], [1, 0.1], [1, 0.9], [0.69, 0.9]] as [number, number][] },
  { id: "pb", nama: "Ujung bawah", jenis: "pintu", poligon: [[0, 0.9], [1, 0.9], [1, 1], [0, 1]] as [number, number][] },
];
const DATA = {
  jejak: [{ nomor: 12, x: 0.8, y: 0.5, garis: [[0.8, 0.2], [0.8, 0.35], [0.8, 0.5]] as [number, number][], zona: "lr" }],
  zona: ZONA, pintu: { masuk: 3, keluar: 6 },
  teks: { hud: "Mata · di perangkat ini", masuk: "Masuk", keluar: "Keluar" },
  warna: { aksen: "#E9A825", terang: "#fff", gelap: "#1C1B18", hidup: "#23704A" },
};

describe("lapisan pelacakan Mata", () => {
  test("nomor anonim, zona terisi berlabel jumlah orang, panel kepala dengan hitungan pintu", () => {
    const { g, teks } = kuasPalsu();
    gambarMata(g, 640, 360, DATA);
    expect(teks).toContain("#12");
    expect(teks).toContain("Lorong kanan · 1");
    expect(teks).toContain("Ujung bawah");
    expect(teks).toContain("Mata · di perangkat ini");
    expect(teks).toContain("Masuk 3    Keluar 6");
  });
  test("zona kosong bergaris putus, zona terisi bergaris utuh", () => {
    const { g, putus } = kuasPalsu();
    gambarMata(g, 640, 360, DATA);
    // urutan zona: lr (terisi, utuh []), lalu reset [], lalu pb (kosong, putus), lalu reset
    expect(putus[0]).toEqual([]);
    expect(putus[2].length).toBe(2);
  });
  test("jumlah orang per zona dari jejak yang terlihat", () => {
    expect(isiZona([...DATA.jejak, { ...DATA.jejak[0], nomor: 13 }, { ...DATA.jejak[0], nomor: 14, zona: null }])).toEqual({ lr: 2 });
  });
});
