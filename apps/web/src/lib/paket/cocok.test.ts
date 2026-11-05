import { describe, expect, test } from "vitest";
import { cocokkanUsaha } from "./cocok";

// W-06: 20 kalimat jenis usaha yang ditulis seperti pemilik bercerita. Kriteria: paket masuk akal dan topi baru yang wajar.
const KASUS: [string, string, string[]][] = [
  ["Saya jualan kue kering online lewat Instagram, dibantu dua orang yang memanggang dan satu kurir", "produksi", ["pembuat_kue", "admin_online", "kurir"]],
  ["Pabrik tahu kecil di rumah, ada 6 pekerja giling dan cetak tahu, dijual ke pasar", "produksi", ["operator_produksi"]],
  ["Sekolah kursus bahasa Inggris untuk anak SD, 4 guru dan 1 admin", "pendidikan", ["pengajar", "admin_keuangan"]],
  ["Peternak lele, punya 12 kolam terpal dan 2 pekerja", "pertanian", ["perawat_kolam"]],
  ["Konveksi kaos sablon, menerima pesanan seragam komunitas", "produksi", ["penjahit", "penyablon"]],
  ["Bimbel SMP dan SMA di garasi rumah, 3 pengajar", "pendidikan", ["pengajar"]],
  ["Ternak ayam petelur 2000 ekor, telur dijual ke warung sekitar", "pertanian", ["perawat_ternak"]],
  ["Kebun hidroponik selada dan pakcoy, kirim ke restoran", "pertanian", ["pekerja_kebun"]],
  ["Usaha mebel kayu jati, ada 5 tukang", "produksi", ["tukang_kayu"]],
  ["Daycare penitipan anak untuk ibu bekerja, 4 pengasuh", "pendidikan", ["pengasuh"]],
  ["Jasa pindahan rumah dengan 2 truk dan 3 sopir", "logistik", ["sopir"]],
  ["Toko sembako dan kelontong dekat pasar", "toko", []],
  ["Reseller hijab online di Shopee dan TikTok, dibantu adik packing", "toko", ["admin_online", "pengemas"]],
  ["Kedai kopi kecil dengan 2 barista", "fnb", []],
  ["Katering nasi kotak untuk kantor, ada kurir antar", "fnb", ["kurir"]],
  ["Barbershop dua kursi", "salon", []],
  ["Laundry kiloan dan setrika", "laundry", []],
  ["Bengkel motor dan tambal ban", "bengkel", []],
  ["Agensi desain dan konten media sosial, 3 desainer", "kantor", ["desainer"]],
  ["Homestay 6 kamar dekat pantai", "hotel", []],
];

describe("cocokkanUsaha", () => {
  test.each(KASUS)("%s -> %s", (cerita, paket, topi) => {
    const h = cocokkanUsaha(cerita);
    expect(h.paket).toBe(paket);
    expect(h.yakin).toBeGreaterThan(0.5);
    for (const k of topi) expect(h.topi.map((x) => x.kode)).toContain(k);
  });

  test("tanpa kata kunci: paket pangkal dengan keyakinan 0, tanpa topi", () => {
    const h = cocokkanUsaha("Usaha keluarga kami sudah berjalan sepuluh tahun");
    expect(h).toMatchObject({ yakin: 0, topi: [] });
  });

  test("topi bawaan paket tidak diulang dan paling banyak 6 topi", () => {
    const h = cocokkanUsaha("Kafe dengan kasir, kurir, admin online, pembuat kue, pengemas, desainer, sopir truk, guru les");
    expect(h.topi.length).toBeLessThanOrEqual(6);
    expect(h.topi.map((x) => x.kode)).not.toContain("kasir");
  });
});
