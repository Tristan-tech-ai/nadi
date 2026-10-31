import { describe, expect, it } from "vitest";
import { alasanUsulan, bagiAdil, bagiRakus, bebanPerJam, gini, ringkasBeban, usulkanPelaksana, type KerjaBaru, type OrangBeban } from "./adil";

// Contoh hitung docs/research/bagi-adil-algoritma.md: tiga kasir, kerja baru 4, 3, 2, 2 poin.
const KASIR = "kasir";
const contoh = (): OrangBeban[] => [
  { id: "sari", nama: "Sari", jam: 40, poin: 20, topi: [KASIR], terakhirDiberi: null },
  { id: "budi", nama: "Budi", jam: 40, poin: 10, topi: [KASIR], terakhirDiberi: null },
  { id: "dewi", nama: "Dewi", jam: 20, poin: 4, topi: [KASIR], terakhirDiberi: null },
];
const kerjaContoh: KerjaBaru[] = [4, 3, 2, 2].map((poin, i) => ({ id: `k${i + 1}`, poin, topi: KASIR }));
const bulat4 = (x: number) => Math.round(x * 1e4) / 1e4;
const giniDari = (o: OrangBeban[]) => gini(o.map(bebanPerJam));

describe("contoh dokumen: Sari 40 jam 20 poin, Budi 40 jam 10, Dewi 20 jam 4; kerja 4, 3, 2, 2", () => {
  it("Gini awal 0,2105", () => {
    expect(contoh().map(bebanPerJam)).toEqual([0.5, 0.25, 0.2]);
    expect(bulat4(giniDari(contoh()))).toBe(0.2105);
  });
  it("rakus: semua ke Sari, Gini 0,3129", () => {
    const r = bagiRakus(contoh(), kerjaContoh);
    expect(r.penugasan.map((p) => p.orang)).toEqual(["sari", "sari", "sari", "sari"]);
    expect(r.orang.map(bebanPerJam)).toEqual([0.775, 0.25, 0.2]);
    expect(bulat4(giniDari(r.orang))).toBe(0.3129);
  });
  it("adil v1: 4 Budi, 3 Dewi, 2 Budi, 2 Budi, Gini 0,0769 (lebih rendah dari rakus)", () => {
    const a = bagiAdil(contoh(), kerjaContoh);
    expect(a.penugasan).toEqual([
      { kerja: "k1", orang: "budi" }, { kerja: "k2", orang: "dewi" }, { kerja: "k3", orang: "budi" }, { kerja: "k4", orang: "budi" },
    ]);
    expect(a.orang.map(bebanPerJam)).toEqual([0.5, 0.45, 0.35]);
    expect(bulat4(giniDari(a.orang))).toBe(0.0769);
    expect(giniDari(a.orang)).toBeLessThan(giniDari(bagiRakus(contoh(), kerjaContoh).orang));
  });
  it("langkah 4 seri tepat (Budi 18/40 = Dewi 9/20 = 0,45): keduanya diberi kerja di kali bagi yang sama, jadi diputus id", () => {
    const sesudah3 = bagiAdil(contoh(), kerjaContoh.slice(0, 3));
    const u = usulkanPelaksana(sesudah3.orang, KASIR, 2)!;
    expect(u.orang.id).toBe("budi");
    expect(u.seriDengan?.id).toBe("dewi");
  });
});

describe("seri diputus dengan yang paling lama tidak diberi kerja, lalu id", () => {
  const dua = (budi: number | null, dewi: number | null): OrangBeban[] => [
    { id: "budi", nama: "Budi", jam: 40, poin: 3, topi: [KASIR], terakhirDiberi: budi },
    { id: "dewi", nama: "Dewi", jam: 40, poin: 3, topi: [KASIR], terakhirDiberi: dewi },
  ];
  it("yang lebih lama tidak diberi kerja menang", () => {
    expect(usulkanPelaksana(dua(200, 100), KASIR, 2)!.orang.id).toBe("dewi");
    expect(usulkanPelaksana(dua(100, 200), KASIR, 2)!.orang.id).toBe("budi");
  });
  it("belum pernah diberi kerja dianggap paling lama", () => {
    expect(usulkanPelaksana(dua(100, null), KASIR, 2)!.orang.id).toBe("dewi");
  });
  it("sama-sama belum pernah: id", () => {
    expect(usulkanPelaksana(dua(null, null), KASIR, 2)!.orang.id).toBe("budi");
  });
  it("antre ikut dihitung: kerja yang sudah ditugaskan tetapi belum dimulai membuat orang lebih berat", () => {
    const o = dua(null, null);
    o[0].antre = 2;
    expect(usulkanPelaksana(o, KASIR, 1)!.orang.id).toBe("dewi");
  });
});

describe("alasan satu kalimat (sama dengan public.usulan_pelaksana)", () => {
  it("paling ringan, dengan antre dan seri", () => {
    const o: OrangBeban[] = [
      { id: "a", nama: "Sari", jam: 40, poin: 9, topi: [KASIR], terakhirDiberi: 1 },
      { id: "b", nama: "Budi", jam: 40, poin: 6, topi: [KASIR], terakhirDiberi: 1 },
    ];
    expect(alasanUsulan(usulkanPelaksana(o, KASIR, 1)!, "Kasir")).toBe("Budi: 6 poin minggu ini, paling ringan di antara kasir.");
    o[1].antre = 1.5;
    o[1].poin = 2.5;
    o[0].poin = 4;
    o[1].terakhirDiberi = 0; // seri 5/40: Budi lebih lama tidak diberi kerja
    expect(alasanUsulan(usulkanPelaksana(o, KASIR, 1)!, "Kasir")).toBe("Budi: 2,5 poin minggu ini dan 1,5 poin antre, paling ringan di antara kasir; sama ringan dengan Sari.");
  });
  it("satu-satunya pemakai topi", () => {
    const o: OrangBeban[] = [{ id: "t", nama: "Tono", jam: 40, poin: 0, topi: ["cuci"], terakhirDiberi: null }];
    expect(alasanUsulan(usulkanPelaksana(o, "cuci", 1)!, "Pencuci")).toBe("Tono: satu-satunya yang memakai topi pencuci, 0 poin minggu ini.");
  });
  it("tanpa pemakai topi: tidak ada usulan", () => {
    expect(usulkanPelaksana(contoh(), "gudang", 1)).toBeNull();
  });
});

describe("ringkasan layar", () => {
  it("yang paling berat beserta porsi poin dan porsi jam", () => {
    const r = ringkasBeban(contoh() as (OrangBeban & { nama: string })[]);
    expect(r.terberat).toEqual({ id: "sari", nama: "Sari", porsiPoin: 59, porsiJam: 40 });
    expect(r.totalPoin).toBe(34);
  });
  it("semua nol: tidak ada yang paling berat, Gini 0", () => {
    const r = ringkasBeban([{ id: "x", nama: "X", jam: 40, poin: 0, topi: [], terakhirDiberi: null }]);
    expect(r.terberat).toBeNull();
    expect(r.gini).toBe(0);
  });
  it("Gini: rata = 0, satu orang memikul semua dari n = (n - 1) / n", () => {
    expect(gini([3, 3, 3])).toBe(0);
    expect(gini([0, 0, 0, 8])).toBeCloseTo(0.75, 12);
    expect(gini([])).toBe(0);
  });
});

// Data sintetis acak dengan benih tetap (mulberry32, sama dengan pembuat soal uji kerja).
function mulberry32(benih: number) {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sintetis(benih: number) {
  const acak = mulberry32(benih);
  const pilih = <T,>(xs: readonly T[]) => xs[Math.floor(acak() * xs.length)];
  const TOPI = ["kasir", "dapur", "gudang"];
  const orang: OrangBeban[] = Array.from({ length: 8 }, (_, i) => {
    const utama = TOPI[i % 3]; // tiap topi dipakai paling sedikit 2 orang
    const tambahan = acak() < 0.5 ? [pilih(TOPI)] : [];
    return {
      id: `o${i}`,
      jam: pilih([20, 30, 40, 48]),
      poin: Math.round(acak() * 30 * 4) / 4,
      topi: [...new Set([utama, ...tambahan])],
      terakhirDiberi: acak() < 0.2 ? null : Math.floor(acak() * 1000),
    };
  });
  const kerja: KerjaBaru[] = Array.from({ length: 200 }, (_, i) => ({ id: `k${i}`, topi: pilih(TOPI), poin: (1 + Math.floor(acak() * 32)) / 4 }));
  return { orang, kerja };
}

describe("data sintetis: 50 benih, 200 kerja, 8 orang, 3 topi", () => {
  const hasil = Array.from({ length: 50 }, (_, i) => {
    const { orang, kerja } = sintetis(i + 1);
    const adil = bagiAdil(orang, kerja, 2000);
    const rakus = bagiRakus(orang, kerja);
    return { benih: i + 1, orang, kerja, adil, rakus, gAdil: giniDari(adil.orang), gRakus: giniDari(rakus.orang), gAwal: giniDari(orang) };
  });

  it.each(hasil.map((h) => [h.benih, h]))("benih %i: gini(adil) < gini(rakus)", (_, h) => {
    expect(h.gAdil).toBeLessThan(h.gRakus);
  });

  it("setiap kerja hanya diberikan ke orang bertopi cocok, dan semua kerja terbagi", () => {
    for (const h of hasil) {
      const topiKerja = new Map(h.kerja.map((k) => [k.id, k.topi]));
      const topiOrang = new Map(h.orang.map((o) => [o.id, o.topi]));
      for (const { penugasan } of [h.adil, h.rakus]) {
        expect(penugasan).toHaveLength(200);
        for (const p of penugasan) {
          expect(p.orang, `benih ${h.benih} ${p.kerja}`).not.toBeNull();
          expect(topiOrang.get(p.orang!), `benih ${h.benih} ${p.kerja}`).toContain(topiKerja.get(p.kerja));
        }
      }
    }
  });

  it("poin tidak hilang: total sesudah = total awal + total kerja", () => {
    for (const h of hasil) {
      const awal = h.orang.reduce((a, o) => a + o.poin, 0) + h.kerja.reduce((a, k) => a + k.poin, 0);
      expect(h.adil.orang.reduce((a, o) => a + o.poin, 0)).toBeCloseTo(awal, 9);
      expect(h.rakus.orang.reduce((a, o) => a + o.poin, 0)).toBeCloseTo(awal, 9);
    }
  });

  it("ringkasan angka 50 benih (dicetak untuk bukti)", () => {
    const rata = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const ringkas = {
      awal: bulat4(rata(hasil.map((h) => h.gAwal))),
      rakus: bulat4(rata(hasil.map((h) => h.gRakus))),
      adil: bulat4(rata(hasil.map((h) => h.gAdil))),
      adilTerburuk: bulat4(Math.max(...hasil.map((h) => h.gAdil))),
      rakusTerbaik: bulat4(Math.min(...hasil.map((h) => h.gRakus))),
    };
    console.log("Gini rata-rata 50 benih", JSON.stringify(ringkas));
    expect(ringkas.adil).toBeLessThan(ringkas.rakus);
  });
});

describe("teks layar beban", () => {
  it("kalimat yang paling berat", async () => {
    const { kalimatTerberat } = await import("./adil");
    expect(kalimatTerberat(ringkasBeban(contoh() as (OrangBeban & { nama: string })[]))).toBe("Sari memikul 59% kerja minggu ini dengan 40% jam kerja.");
    expect(kalimatTerberat({ terberat: null, gini: 0, totalPoin: 0 })).toBeNull();
  });
  it("staf: poin sendiri dan rata-rata tim, tanpa nama", async () => {
    const { teksBebanSaya } = await import("./adil");
    const dasar = { mulai: "2026-10-26", akhir: "2026-11-01", n: 4, di_atas: false };
    expect(teksBebanSaya({ ...dasar, poin: 18, rata_rata: 15 })).toBe("Minggu ini 18 poin. Rata-rata tim 15.");
    expect(teksBebanSaya({ ...dasar, poin: 9, rata_rata: 3.8 })).toBe("Minggu ini 9 poin. Rata-rata tim 3,8.");
    expect(teksBebanSaya({ ...dasar, n: 2, poin: 2.5, rata_rata: null })).toBe("Minggu ini 2,5 poin. Rata-rata tim tampil bila tim minimal 3 orang.");
  });
});
