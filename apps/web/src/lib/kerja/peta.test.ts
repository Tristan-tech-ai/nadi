import { describe, expect, it } from "vitest";
import { bacaPeta, bagianTopi, dasarSaran, gabung, kalimatOrang, kalimatSerah, kalimatTopi, ringkasanGraf, tataLetak, tebalGaris, teksPasang, type GarisPeta, type Peta } from "./peta";

// Data sama dengan supabase/tests/peta_organisasi.test.sql: Sari kasir 10 poin, Budi kasir 2 (kertas kasir dan gudang), Dewi
// kasir 6 lintas + pelayan 4, Eko gudang 3.
const g = (orang_id: string, topi_id: string, x: Partial<GarisPeta>): GarisPeta => ({
  orang_id, topi_id, kertas: false, porsi: null, n: 0, poin: 0, lintas: false, lintas_n: 0, lintas_poin: 0,
  persen_topi: null, persen_orang: null, persen_lintas: null, ...x,
});
const contoh = (): Peta => bacaPeta({
  mulai: "2026-10-05", akhir: "2026-11-01", zona: "Asia/Jakarta", minggu: 4, ambang: 3, selesai_n: 11, poin: "25.00" as unknown as number,
  kepala: "60% kerja Dewi 4 minggu terakhir adalah urusan kasir, walau topinya pelayan.",
  orang: [
    { id: "budi", nama: "Budi", jabatan: null, n: 1, poin: 2, cukup: false, tanpa_topi_poin: 0, topi_ids: ["gudang", "kasir"] },
    { id: "dewi", nama: "Dewi", jabatan: "Pelayan", n: 4, poin: 10, cukup: true, tanpa_topi_poin: 0, topi_ids: ["pelayan"] },
    { id: "eko", nama: "Eko", jabatan: null, n: 3, poin: 3, cukup: true, tanpa_topi_poin: 0, topi_ids: ["gudang"] },
    { id: "sari", nama: "Sari", jabatan: null, n: 3, poin: 10, cukup: true, tanpa_topi_poin: 0, topi_ids: ["kasir"] },
  ],
  topi: [
    { id: "gudang", nama: "Gudang", n: 3, poin: 3, cukup: true },
    { id: "kasir", nama: "Kasir", n: 6, poin: "18.00" as unknown as number, cukup: true },
    { id: "pelayan", nama: "Pelayan", n: 2, poin: 4, cukup: false },
  ],
  garis: [
    g("budi", "gudang", { kertas: true, porsi: 50, persen_topi: 0 }),
    g("budi", "kasir", { kertas: true, porsi: 50, n: 1, poin: 2, persen_topi: 11 }),
    g("dewi", "kasir", { n: 2, poin: 6, lintas: true, lintas_n: 2, lintas_poin: 6, persen_topi: 33, persen_orang: 60, persen_lintas: 60 }),
    g("dewi", "pelayan", { kertas: true, porsi: 100, n: 2, poin: 4, persen_orang: 40 }),
    g("eko", "gudang", { kertas: true, porsi: 100, n: 3, poin: 3, persen_topi: 100, persen_orang: 100 }),
    g("sari", "kasir", { kertas: true, porsi: 100, n: 3, poin: 10, persen_topi: 56, persen_orang: 100 }),
  ],
  saran: [{ orang_id: "dewi", topi_id: "kasir", orang_nama: "Dewi", topi_nama: "Kasir", persen: 60, lintas_poin: 6, orang_poin: 10, kertas_nama: "pelayan", usulan_id: null }],
  serah: [{ pemberi_id: "sari", pemberi_peran: null, pemberi_nama: "Sari", pelaksana_id: "dewi", pelaksana_nama: "Dewi", n: 3, selesai_n: 2 }],
  serah_tanpa_pemberi: 9, tanpa_peta_n: 1,
});

describe("tata letak dua kolom", () => {
  it("topi urut poin nyata terbesar: kasir, pelayan, gudang", () => {
    expect(tataLetak(contoh()).topi.map((t) => t.id)).toEqual(["kasir", "pelayan", "gudang"]);
  });
  it("orang urut titik berat topinya: Sari dan Budi (kasir) di atas, Dewi (kasir dan pelayan), Eko (gudang) di bawah", () => {
    expect(tataLetak(contoh()).orang.map((o) => o.id)).toEqual(["budi", "sari", "dewi", "eko"]);
  });
  it("posisi y: baris 56, kolom topi yang lebih pendek di tengah", () => {
    const l = tataLetak(contoh(), { baris: 56, atas: 28 });
    expect(l.orang.map((o) => o.y)).toEqual([56, 112, 168, 224]);
    expect(l.topi.map((t) => t.y)).toEqual([84, 140, 196]);
    expect(l.tinggi).toBe(28 * 2 + 4 * 56);
    const dewiKasir = l.garis.find((x) => x.orang_id === "dewi" && x.topi_id === "kasir")!;
    expect([dewiKasir.y1, dewiKasir.y2]).toEqual([168, 84]);
  });
  it("orang tanpa kerja dan tanpa topi ke paling bawah, seri diurut nama", () => {
    const p = contoh();
    p.orang.push({ id: "ani", nama: "Ani", jabatan: null, n: 0, poin: 0, cukup: false, tanpa_topi_poin: 0, topi_ids: [] });
    expect(tataLetak(p).orang.map((o) => o.id).at(-1)).toBe("ani");
  });
  it("ketebalan garis dari poin: 10 poin = 10 px, 2 poin = 3,5 px, tanpa kerja 0", () => {
    const l = tataLetak(contoh());
    const tebal = (o: string, t: string) => l.garis.find((x) => x.orang_id === o && x.topi_id === t)!.tebal;
    expect(tebal("sari", "kasir")).toBe(10);
    expect(tebal("dewi", "kasir")).toBe(7);
    expect(tebal("budi", "kasir")).toBe(3.5);
    expect(tebal("budi", "gudang")).toBe(0);
    expect(tebalGaris(0.25, 99)).toBe(2);
    expect(tebalGaris(5, 0)).toBe(0);
  });
});

describe("kalimat", () => {
  it("angka numeric dari jsonb dibaca sebagai number", () => {
    expect(contoh().poin).toBe(25);
    expect(contoh().topi.find((t) => t.id === "kasir")!.poin).toBe(18);
  });
  it("gabung: a, a dan b, a, b, dan c", () => {
    expect([gabung([]), gabung(["a"]), gabung(["a", "b"]), gabung(["a", "b", "c"])]).toEqual(["", "a", "a dan b", "a, b, dan c"]);
  });
  it("per orang: Dewi lintas topi kasir 60% padahal topinya pelayan", () => {
    expect(kalimatOrang(contoh(), "dewi")).toEqual([
      "Dewi: 10 poin dari 4 kerja selesai 4 minggu terakhir.",
      "60% kerjanya urusan kasir (lintas topi), padahal topinya pelayan.",
    ]);
  });
  it("per orang: Budi memakai topi gudang tanpa kerja gudang", () => {
    expect(kalimatOrang(contoh(), "budi")).toEqual([
      "Budi: 2 poin dari 1 kerja selesai 4 minggu terakhir.",
      "Budi memakai topi gudang, belum ada kerja gudang 4 minggu terakhir.",
    ]);
  });
  it("per orang: lintas topi tanpa persen bila orang belum cukup kerja", () => {
    const p = contoh();
    p.garis.push(g("budi", "pelayan", { n: 1, poin: 1, lintas: true, lintas_n: 1, lintas_poin: 1 }));
    expect(kalimatOrang(p, "budi").at(-1)).toBe("1 poin kerjanya urusan pelayan (lintas topi), padahal topinya gudang dan kasir. Persen muncul setelah minimal 3 kerja selesai.");
  });
  it("per topi: kasir dengan persen dan tanda lintas topi", () => {
    expect(kalimatTopi(contoh(), "kasir")).toBe("Kasir: Sari 56%, Dewi 33% (lintas topi), Budi 11%.");
  });
  it("per topi: ambang, pelayan 2 kerja tanpa persen", () => {
    expect(kalimatTopi(contoh(), "pelayan")).toBe("Pelayan: belum cukup kerja untuk persen (2 kerja selesai, butuh 3). Dikerjakan Dewi.");
  });
  it("per topi: tanpa kerja menyebut pemakai di atas kertas", () => {
    const p = contoh();
    p.topi.push({ id: "cuci", nama: "Pencuci", n: 0, poin: 0, cukup: false });
    p.garis.push(g("eko", "cuci", { kertas: true, porsi: 20 }));
    expect(kalimatTopi(p, "cuci")).toBe("Pencuci: belum ada kerja selesai 4 minggu terakhir. Dipakai Eko di atas kertas.");
  });
  it("bagian topi: poin terbesar di atas, pemakai tanpa kerja di bawah", () => {
    expect(bagianTopi(contoh(), "gudang").map((b) => [b.nama, b.persen, b.poin])).toEqual([["Eko", 100, 3], ["Budi", 0, 0]]);
  });
  it("alur serah dan tombol saran", () => {
    const p = contoh();
    expect(kalimatSerah(p.serah[0])).toBe("Sari menyerahkan 3 kerja ke Dewi (2 sudah selesai).");
    expect(kalimatSerah({ ...p.serah[0], selesai_n: 3 })).toBe("Sari menyerahkan 3 kerja ke Dewi (semua sudah selesai).");
    expect(teksPasang(p.saran[0])).toBe("Pasang topi kasir ke Dewi");
    expect(dasarSaran(p.saran[0], 4)).toBe("60% kerja Dewi 4 minggu terakhir (6 dari 10 poin) urusan kasir.");
    expect(ringkasanGraf(p)).toBe("Graf 4 orang dan 3 topi. 1 garis lintas topi. Isi yang sama ada di tabel di bawahnya.");
  });
});
