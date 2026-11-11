import { describe, expect, it } from "vitest";
import { CONTOH_PROYEK_AGENSI as M, type Koleksi } from "./skema";
import {
  aksesPeran, aturDaftar, bacaIsian, bacaParam, bidangFormulir, bolehBuat, bolehUbah, bulanKalender, isoKeLokal, koleksiDari, kolomUrut,
  tampilanLihat, tanggalCatatan, teksNilai, transisiUntuk, type Catatan, type Label,
} from "./tafsir";

const proyek = koleksiDari(M, "proyek")!;
const tugas = koleksiDari(M, "tugas")!;
const aktivitas = koleksiDari(M, "aktivitas")!;
const UID = "11111111-1111-1111-1111-111111111111";
const ORANG = "22222222-2222-2222-2222-222222222222";
const catatan = (x: Partial<Catatan> = {}): Catatan => ({ id: "c1", data: {}, status: "dikerjakan", ditugaskan: [], dibuat_oleh: "lain", dibuat_at: "", diubah_at: "", ...x });
const label = (): Label => ({ orang: new Map([[ORANG, "Sari"]]), pelanggan: new Map(), produk: new Map(), proyek: new Map(), rujukan: new Map([["r1", "Katalog Bali"]]) });

describe("tampilan dari manifest", () => {
  it("koleksi bawaan yang pertama, kode tak dikenal null", () => {
    expect(koleksiDari(M)?.kode).toBe("proyek");
    expect(koleksiDari(M, "tidak-ada")).toBeNull();
  });
  it("tampilan lihat mengikuti manifest, daftar selalu ada, papan butuh status", () => {
    expect(tampilanLihat(tugas)).toEqual(["papan", "daftar", "kalender"]);
    expect(tampilanLihat(aktivitas)).toEqual(["daftar", "kalender"]);
    const tanpaStatus: Koleksi = { ...aktivitas, tampilan: [{ jenis: "papan", kolom_kartu: [] }] };
    expect(tampilanLihat(tanpaStatus)).toEqual(["daftar"]);
  });
  it("formulir tidak pernah memuat bidang rumus", () => {
    const k: Koleksi = { ...tugas, tampilan: [] };
    expect(bidangFormulir(k).map((b) => b.kode)).not.toContain("terlambat");
    expect(bidangFormulir(tugas).map((b) => b.kode)).toEqual(["judul", "proyek", "induk", "pic", "pelaksana", "tenggat"]);
  });
  it("daftar tanpa tampilan daftar memakai judul + 3 bidang", () => {
    expect(aturDaftar({ ...proyek, tampilan: [] }).kolom).toEqual(["nama", "klien", "pic", "tim"]);
  });
});

describe("akses dan transisi (cermin database)", () => {
  it("akses dibatasi AKSES_MAKS: staf paling tinggi tulis walau manifest memberi kelola", () => {
    expect(aksesPeran({ ...proyek, akses: { ...proyek.akses, staf: "kelola" } }, "staf")).toBe("tulis");
    expect(aksesPeran(proyek, "pemilik")).toBe("kelola");
    expect(aksesPeran(proyek, "tamu")).toBe("tidak");
    expect(bolehBuat("lihat")).toBe(false);
  });
  it("milik sendiri: hanya pembuat atau yang ditugaskan", () => {
    expect(bolehUbah("milik_sendiri", catatan({ dibuat_oleh: UID }), { uid: UID, orang: null })).toBe(true);
    expect(bolehUbah("milik_sendiri", catatan({ ditugaskan: [ORANG] }), { uid: UID, orang: ORANG })).toBe(true);
    expect(bolehUbah("milik_sendiri", catatan(), { uid: UID, orang: ORANG })).toBe(false);
  });
  it("transisi: pelaksana mengirim review, pemilik menerima atau minta revisi, akuntan (lihat) tidak apa-apa", () => {
    const c = catatan({ ditugaskan: [ORANG] });
    expect(transisiUntuk(tugas, c, "staf", { uid: UID, orang: ORANG }).map((t) => t.ke)).toEqual(["review"]);
    expect(transisiUntuk(tugas, c, "staf", { uid: UID, orang: "lain" })).toEqual([]);
    const review = catatan({ status: "review" });
    expect(transisiUntuk(tugas, review, "pemilik", { uid: UID, orang: null }).map((t) => t.ke)).toEqual(["dikerjakan", "selesai"]);
    expect(transisiUntuk(tugas, review, "akuntan", { uid: UID, orang: null })).toEqual([]);
  });
});

describe("isian menjadi data", () => {
  const ambil = (isi: Record<string, string[]>) => (k: string) => isi[k] ?? [];
  it("tipe dikonversi, kosong dibuang, wajib dilaporkan", () => {
    const r = bacaIsian(bidangFormulir(proyek), ambil({ nama: [" Katalog "], pic: [ORANG], tim: [ORANG, ORANG], nilai: ["12.500.000"], tenggat: ["2026-12-01"] }), "Asia/Makassar");
    expect(r.galat).toEqual([]);
    expect(r.data).toEqual({ nama: "Katalog", pic: ORANG, tim: [ORANG], nilai: 12500000, tenggat: "2026-12-01" });
    expect(bacaIsian(bidangFormulir(proyek), ambil({}), "Asia/Makassar").galat).toEqual(["Nama proyek wajib diisi", "PIC wajib diisi"]);
  });
  it("tanggal-jam dibaca di zona usaha menjadi ISO UTC, dan kembali ke isian lokal", () => {
    const r = bacaIsian(bidangFormulir(tugas), ambil({ judul: ["Desain"], proyek: ["r1"], pic: [ORANG], tenggat: ["2026-11-20T14:30"] }), "Asia/Makassar");
    expect(r.data.tenggat).toBe("2026-11-20T06:30:00.000Z");
    expect(isoKeLokal(r.data.tenggat, "Asia/Makassar")).toBe("2026-11-20T14:30");
    expect(tanggalCatatan("2026-11-20T17:30:00.000Z", "tanggal_jam", "Asia/Makassar")).toBe("2026-11-21");
  });
  it("bidang di luar formulir dipertahankan dari data lama, bidang yang dikosongkan dihapus", () => {
    const k = tugas.bidang.filter((b) => b.kode === "hasil" || b.kode === "catatan_hasil");
    const r = bacaIsian(k, ambil({ hasil: ["https://drive.example.org/x"] }), "Asia/Makassar", { judul: "Desain", catatan_hasil: "lama", hasil: "https://lama.example.org" });
    expect(r.data).toEqual({ judul: "Desain", hasil: "https://drive.example.org/x" });
  });
  it("menolak tautan bukan https, angka rusak, dan di luar batas", () => {
    const k = [...tugas.bidang.filter((b) => b.kode === "hasil"), ...aktivitas.bidang.filter((b) => b.kode === "durasi")];
    expect(bacaIsian(k, ambil({ hasil: ["javascript:alert(1)"], durasi: ["99999"] }), "Asia/Makassar").galat).toEqual(["Tautan hasil harus tautan https://", "Durasi (menit) di luar batas"]);
    expect(bacaIsian(k, ambil({ durasi: ["dua"] }), "Asia/Makassar").galat).toEqual(["Durasi (menit) harus angka"]);
  });
});

describe("nilai tampil", () => {
  it("rujukan, rupiah, pilihan, tanggal, rumus", () => {
    const d = { pic: ORANG, nilai: 12500000, jenis: "berulang", tenggat: "2026-12-01", proyek: "r1" };
    expect(teksNilai(proyek.bidang.find((b) => b.kode === "pic")!, d, label(), "Asia/Makassar")).toBe("Sari");
    expect(teksNilai(proyek.bidang.find((b) => b.kode === "nilai")!, d, label(), "Asia/Makassar")).toBe("Rp12.500.000");
    expect(teksNilai(proyek.bidang.find((b) => b.kode === "jenis")!, d, label(), "Asia/Makassar")).toBe("Berulang");
    expect(teksNilai(proyek.bidang.find((b) => b.kode === "tenggat")!, d, label(), "Asia/Makassar")).toBe("1 Des 2026");
    expect(teksNilai(tugas.bidang.find((b) => b.kode === "proyek")!, d, label(), "Asia/Makassar")).toBe("Katalog Bali");
    const terlambat = tugas.bidang.find((b) => b.kode === "terlambat")!;
    expect(teksNilai(terlambat, { tenggat: "2026-11-01T00:00:00.000Z" }, label(), "Asia/Makassar", new Date("2026-11-11T05:00:00Z"))).toBe("10");
    expect(teksNilai(terlambat, {}, label(), "Asia/Makassar")).toBe("0");
  });
  it("teks pengguna dikembalikan apa adanya sebagai teks (tidak ditafsirkan)", () => {
    expect(teksNilai(proyek.bidang[0], { nama: "<img src=x onerror=alert(1)>" }, label(), "Asia/Makassar")).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("parameter daftar dari URL", () => {
  it("hanya saringan dan urutan yang ada di manifest; kata cari dibersihkan", () => {
    const p = bacaParam(tugas, { q: "desain%_*(x),'", s_proyek: "11111111-1111-1111-1111-111111111111", s_judul: "x", urut: "data);drop", hal: "-3" });
    expect(p.q).toBe("desain x");
    expect(p.saring).toEqual({ proyek: "11111111-1111-1111-1111-111111111111" });
    expect(p.urut).toBe("dibuat_at");
    expect(p.hal).toBe(1);
    expect(bacaParam(aktivitas, { s_jenis: "tidak-ada" }).saring).toEqual({});
    expect(bacaParam(aktivitas, { s_jenis: "rapat" }).saring).toEqual({ jenis: "rapat" });
  });
  it("urut bawaan dari manifest; angka diurut sebagai jsonb", () => {
    expect(bacaParam(proyek, {})).toMatchObject({ urut: "tenggat", arah: "naik" });
    expect(kolomUrut(proyek, "nilai")).toBe("data->nilai");
    expect(kolomUrut(proyek, "tenggat")).toBe("data->>tenggat");
    expect(kolomUrut(proyek, "x;drop")).toBe("dibuat_at");
  });
});

describe("kalender", () => {
  it("grid Senin pertama, bulan tidak sah memakai bulan berjalan", () => {
    const k = bulanKalender("2026-11", "2026-11-11");
    expect(k.sel.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(k.sel.length % 7).toBe(0);
    expect([k.lalu, k.depan, k.akhir]).toEqual(["2026-10", "2026-12", "2026-11-30"]);
    expect(bulanKalender("2026-13", "2026-11-11").bulan).toBe("2026-11");
    expect(bulanKalender("2026-12", "2026-11-11").depan).toBe("2027-01");
  });
});
