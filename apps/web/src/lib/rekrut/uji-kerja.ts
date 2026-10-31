// Uji kerja per topi (F2-04): soal hitungan pekerjaan sehari-hari dengan angka dari benih per pelamar, sehingga jawaban
// tidak bisa disalin antarpelamar dan bisa dinilai otomatis tanpa model. Satu templat per kode topi paket industri.
import { formatRupiah } from "../format";

export type Soal = { topi: string; teks: string; jawaban: number; satuan: "rupiah" | "gram" | "ml" | "buah" };

/** PRNG mulberry32: deterministik dari benih 32 bit (soal yang sama bisa disusun ulang saat menilai). */
function acak(benih: number) {
  let a = benih >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const antara = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const pilih = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  return { antara, pilih };
}

type Acak = ReturnType<typeof acak>;
const rp = (n: number) => formatRupiah(n);

const MENU = [["nasi goreng", 18000], ["mi goreng", 16000], ["ayam bakar", 25000], ["es teh", 5000], ["kopi susu", 12000], ["roti bakar", 14000]] as const;
const BARANG = [["beras 5 kg", 72000], ["minyak 2 liter", 38500], ["gula 1 kg", 17500], ["telur 1 kg", 28000], ["sabun cuci", 9500], ["kopi sachet", 1500]] as const;

const TEMPLAT: Record<string, (a: Acak) => Omit<Soal, "topi">> = {
  kasir: (a) => {
    const isi = [0, 1, 2].map(() => [a.pilih(BARANG), a.antara(1, 3)] as const);
    const total = isi.reduce((s, [[, h], q]) => s + h * q, 0);
    const bayar = Math.ceil((total + 1) / 50000) * 50000;
    const daftar = isi.map(([[n, h], q]) => `${q} x ${n} @ ${rp(h)}`).join(", ");
    return { teks: `Pembeli membeli ${daftar}. Ia membayar ${rp(bayar)}. Berapa kembaliannya?`, jawaban: bayar - total, satuan: "rupiah" };
  },
  pelayan: (a) => {
    const isi = [0, 1, 2].map(() => [a.pilih(MENU), a.antara(1, 3)] as const);
    const total = isi.reduce((s, [[, h], q]) => s + h * q, 0);
    const orang = a.antara(2, 4);
    const daftar = isi.map(([[n], q]) => `${q} ${n}`).join(", ");
    const harga = [...new Map(isi.map(([[n, h]]) => [n, h])).entries()].map(([n, h]) => `${n} ${rp(h)}`).join(", ");
    return {
      teks: `Meja 5 memesan ${daftar} (harga: ${harga}). Tagihan dibagi rata untuk ${orang} orang, dibulatkan ke atas ke ratusan rupiah. Berapa yang dibayar tiap orang?`,
      jawaban: Math.ceil(total / orang / 100) * 100,
      satuan: "rupiah",
    };
  },
  koki: (a) => {
    const porsi = a.pilih([4, 5, 6] as const);
    const gram = porsi * a.antara(20, 60) * 5;
    const jadi = a.pilih([10, 12, 15, 20, 30] as const);
    const bahan = a.pilih(["tepung", "daging ayam", "beras", "gula"] as const);
    return { teks: `Resep untuk ${porsi} porsi memakai ${gram} gram ${bahan}. Hari ini harus dimasak ${jadi} porsi. Berapa gram ${bahan} yang dibutuhkan?`, jawaban: (gram * jadi) / porsi, satuan: "gram" };
  },
  barista: (a) => {
    const rasio = a.pilih([15, 16, 17] as const);
    const kopi = a.pilih([15, 18, 20, 22, 25] as const);
    return { teks: `Resep seduh manual memakai perbandingan kopi dan air 1:${rasio}. Kamu memakai ${kopi} gram kopi. Berapa ml air yang dituang? (1 gram air = 1 ml)`, jawaban: kopi * rasio, satuan: "ml" };
  },
  gudang: (a) => {
    const [n] = a.pilih(BARANG);
    const awal = a.antara(20, 60);
    const masuk = a.antara(10, 40);
    const keluar = a.antara(15, awal + masuk - 5);
    const fisik = awal + masuk - keluar + a.antara(-4, 2);
    return {
      teks: `Stok ${n} awal minggu ${awal} buah, masuk ${masuk}, terjual ${keluar}. Saat dihitung di rak ada ${fisik}. Berapa selisih hitungan fisik dibanding catatan? (tulis minus bila kurang)`,
      jawaban: fisik - (awal + masuk - keluar),
      satuan: "buah",
    };
  },
  pramuniaga: (a) => {
    const harga = a.antara(8, 40) * 5000;
    const d1 = a.pilih([10, 20, 25] as const);
    const d2 = a.pilih([0, 10] as const);
    const akhir = Math.round((harga * (100 - d1) * (100 - d2)) / 10000);
    const tambahan = d2 ? `, lalu diskon tambahan ${d2}% dari harga setelah diskon pertama` : "";
    return { teks: `Baju seharga ${rp(harga)} diskon ${d1}%${tambahan}. Berapa harga yang dibayar pembeli?`, jawaban: akhir, satuan: "rupiah" };
  },
  sales: (a) => {
    const hari = 25;
    const lewat = a.pilih([10, 15, 20] as const);
    const sisaHari = hari - lewat;
    const perHari = a.antara(4, 12) * 50000;
    const capai = a.antara(20, 60) * 100000;
    const target = capai + perHari * sisaHari;
    return {
      teks: `Target penjualan bulan ini ${rp(target)} dalam ${hari} hari kerja. Setelah ${lewat} hari kerja tercapai ${rp(capai)}. Berapa penjualan rata-rata per hari yang dibutuhkan di sisa hari kerja?`,
      jawaban: perHari,
      satuan: "rupiah",
    };
  },
};

export const TOPI_UJI = Object.keys(TEMPLAT);

/** n soal untuk satu kode topi; null bila topi belum punya templat. */
export function buatUji(kodeTopi: string, benih: number, n = 3): Soal[] | null {
  const t = TEMPLAT[kodeTopi];
  if (!t) return null;
  const a = acak(benih);
  return Array.from({ length: n }, () => ({ topi: kodeTopi, ...t(a) }));
}

/** Angka dari isian pelamar: "Rp12.500", "12.500", "12500", "-3" -> angka; null bila tidak terbaca. */
export function bacaAngka(teks: string): number | null {
  const s = teks.replace(/rp|gram|gr|ml|buah|\s/gi, "");
  if (!/^[-−]?\d{1,3}(\.\d{3})*(,\d+)?$|^[-−]?\d+(,\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/^−/, "-").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Nilai uji: jumlah jawaban benar (persis) dari soal yang disusun ulang dari benih yang sama. */
export function nilaiUji(soal: Soal[], jawaban: string[]): { benar: number; dari: number; per: boolean[] } {
  const per = soal.map((s, i) => bacaAngka(jawaban[i] ?? "") === s.jawaban);
  return { benar: per.filter(Boolean).length, dari: soal.length, per };
}
