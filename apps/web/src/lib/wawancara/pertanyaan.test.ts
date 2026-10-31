import { describe, expect, it } from "vitest";
import { cekLowongan } from "../rekrut/bias";
import { pertanyaanDariTopi, ringkasanWawancara } from "./pertanyaan";

const pelayan = { nama: "Pelayan", keahlian: ["Melayani pelanggan"], tanggung_jawab: ["Menyambut tamu", "Mencatat pesanan", "Membersihkan meja"] };

describe("pertanyaanDariTopi", () => {
  it("maksimal 5, dimulai pengalaman dan diakhiri kesediaan waktu, tanpa pertanyaan bias", () => {
    const p = pertanyaanDariTopi(pelayan);
    expect(p).toHaveLength(5);
    expect(p[0]).toBe("Ceritakan pengalamanmu sebagai pelayan.");
    expect(p[1]).toBe("Ceritakan pengalamanmu dalam melayani pelanggan.");
    expect(p[2]).toBe("Bagaimana caramu menyambut tamu?");
    expect(p[4]).toMatch(/^Kapan kamu bisa mulai bekerja/);
    for (const x of p) expect(cekLowongan(x), x).toEqual([]);
  });
  it("topi tanpa keahlian tetap memberi pertanyaan pengalaman dan waktu; batas bisa dikecilkan", () => {
    expect(pertanyaanDariTopi({ nama: "Kurir" })).toEqual(["Ceritakan pengalamanmu sebagai kurir.", "Kapan kamu bisa mulai bekerja, dan shift apa saja yang kamu sanggupi?"]);
    expect(pertanyaanDariTopi(pelayan, 3)).toHaveLength(3);
  });
});

describe("ringkasanWawancara", () => {
  it("menilai dari transkrip dan mengutip kalimat pendukung per kriteria", () => {
    const r = ringkasanWawancara(pelayan, [
      { transkrip: "Saya pernah jadi pelayan di kafe dua tahun. Saya suka melayani pelanggan." },
      { transkrip: "Saya biasa mencatat pesanan dengan teliti." },
      { transkrip: null },
    ]);
    expect(r.nilai.cocok).toEqual(["Pernah bekerja sebagai pelayan", "Melayani pelanggan", "Mencatat pesanan"]);
    expect(r.kutipan).toEqual([
      { kriteria: "Pernah bekerja sebagai pelayan", kalimat: "Saya pernah jadi pelayan di kafe dua tahun." },
      { kriteria: "Melayani pelanggan", kalimat: "Saya suka melayani pelanggan." },
      { kriteria: "Mencatat pesanan", kalimat: "Saya biasa mencatat pesanan dengan teliti." },
    ]);
    expect(r.jawabanKosong).toBe(1);
  });
  it("tanpa transkrip: skor 0 dan tanpa kutipan", () => {
    const r = ringkasanWawancara(pelayan, [{ transkrip: "" }]);
    expect(r.nilai.skor).toBe(0);
    expect(r.kutipan).toEqual([]);
  });
});
