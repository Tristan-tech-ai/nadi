// W-06 paket industri terbuka: cerita pemilik ("jualan kue kering online, dibantu dua orang yang memanggang") dipetakan ke paket
// industri terdekat plus topi baru, lewat aturan kata kunci (tanpa model, tanpa biaya). Hasilnya usulan yang disetujui pemilik.
// Dipakai server (buatPerusahaan) dan diuji 20 kalimat di cocok.test.ts. Rancangan: docs/research/paket-terbuka.md.

export type KodePaket = "fnb" | "toko" | "kantor" | "bengkel" | "klinik" | "konstruksi" | "logistik" | "hotel" | "salon" | "laundry" | "produksi" | "pertanian" | "pendidikan";
export type TopiBaru = { kode: string; nama: string; tanggung_jawab: string[] };
export type HasilCocok = { paket: KodePaket; yakin: number; kata: string[]; topi: TopiBaru[] };

/** Kata kunci per paket. Bobot 2 untuk kata yang hampir pasti, 1 untuk kata yang sering muncul di jenis lain juga. */
const KATA_PAKET: Record<KodePaket, [string, number][]> = {
  fnb: [["warung makan", 2], ["kafe", 2], ["cafe", 2], ["restoran", 2], ["rumah makan", 2], ["katering", 2], ["catering", 2], ["kedai", 2], ["angkringan", 2], ["kopi", 1], ["makanan", 1], ["minuman", 1], ["masak", 1], ["bakso", 2], ["mie", 1], ["nasi", 1], ["kue", 1], ["roti", 1], ["jus", 1], ["seblak", 2], ["martabak", 2], ["pecel", 2], ["sate", 2]],
  toko: [["toko", 2], ["minimarket", 2], ["grosir", 2], ["kelontong", 2], ["jualan", 1], ["jual", 1], ["online", 1], ["olshop", 2], ["marketplace", 2], ["shopee", 2], ["tokopedia", 2], ["reseller", 2], ["dropship", 2], ["distributor", 1], ["butik", 2], ["baju", 1], ["pakaian", 1], ["sembako", 2], ["apotek", 1]],
  kantor: [["kantor", 2], ["konsultan", 2], ["agensi", 2], ["agency", 2], ["notaris", 2], ["akuntan", 2], ["desain", 1], ["software", 2], ["aplikasi", 1], ["digital", 1], ["percetakan", 1], ["event organizer", 2], ["travel", 1]],
  bengkel: [["bengkel", 2], ["servis motor", 2], ["service motor", 2], ["tambal ban", 2], ["cuci motor", 2], ["cuci mobil", 2], ["montir", 2], ["onderdil", 2], ["sparepart", 2]],
  klinik: [["klinik", 2], ["praktik dokter", 2], ["dokter gigi", 2], ["bidan", 2], ["apotek", 1], ["fisioterapi", 2], ["klinik hewan", 2], ["dokter hewan", 2]],
  konstruksi: [["kontraktor", 2], ["renovasi", 2], ["bangunan", 1], ["tukang", 1], ["konstruksi", 2], ["interior", 1], ["las", 1], ["bengkel las", 2]],
  logistik: [["ekspedisi", 2], ["kurir", 1], ["gudang", 1], ["logistik", 2], ["pengiriman", 1], ["angkutan", 2], ["truk", 2], ["pindahan", 2]],
  hotel: [["hotel", 2], ["penginapan", 2], ["homestay", 2], ["vila", 2], ["villa", 2], ["kos", 2], ["kost", 2], ["guest house", 2]],
  salon: [["salon", 2], ["barbershop", 2], ["pangkas rambut", 2], ["spa", 2], ["pijat", 2], ["nail", 2], ["kuku", 1], ["rias", 2], ["mua", 2]],
  laundry: [["laundry", 2], ["londri", 2], ["cuci baju", 2], ["setrika", 2], ["dry clean", 2]],
  produksi: [["pabrik", 2], ["produksi", 2], ["konveksi", 2], ["jahit", 2], ["sablon", 2], ["home industry", 2], ["industri rumahan", 2], ["kerajinan", 2], ["mebel", 2], ["furnitur", 2], ["tahu", 2], ["tempe", 2], ["keripik", 2], ["frozen food", 2], ["sambal", 1], ["kemasan", 1], ["batik", 2], ["memanggang", 2], ["kue kering", 2], ["oleh oleh", 2]],
  pertanian: [["ternak", 2], ["peternak", 2], ["peternakan", 2], ["lele", 2], ["ikan", 1], ["tambak", 2], ["kolam", 1], ["ayam petelur", 2], ["ayam", 1], ["sapi", 2], ["kambing", 2], ["kebun", 2], ["sawah", 2], ["petani", 2], ["pertanian", 2], ["hidroponik", 2], ["jamur", 2], ["madu", 2], ["bibit", 2]],
  pendidikan: [["kursus", 2], ["les", 2], ["bimbel", 2], ["bimbingan belajar", 2], ["sekolah", 2], ["paud", 2], ["tk", 1], ["pelatihan", 2], ["mengajar", 2], ["guru", 2], ["mengaji", 2], ["tpa", 1], ["daycare", 2], ["penitipan anak", 2]],
};

/** Topi yang dikenali dari cerita: kata kunci -> topi. Topi bawaan paket tidak diulang. */
const KATA_TOPI: { kata: string[]; topi: TopiBaru }[] = [
  { kata: ["memanggang", "baker", "bikin kue", "membuat kue", "kue"], topi: { kode: "pembuat_kue", nama: "Pembuat kue", tanggung_jawab: ["Menyiapkan adonan", "Memanggang sesuai pesanan"] } },
  { kata: ["online", "olshop", "instagram", "shopee", "tokopedia", "tiktok", "whatsapp", "marketplace"], topi: { kode: "admin_online", nama: "Admin pesanan online", tanggung_jawab: ["Membalas chat pembeli", "Mencatat pesanan online"] } },
  { kata: ["kurir", "antar", "mengantar", "pengantar"], topi: { kode: "kurir", nama: "Kurir", tanggung_jawab: ["Mengantar pesanan", "Membawa bukti terima"] } },
  { kata: ["kemas", "packing", "mengemas", "kemasan"], topi: { kode: "pengemas", nama: "Pengemas", tanggung_jawab: ["Mengemas pesanan", "Menempel label kirim"] } },
  { kata: ["pabrik", "produksi", "operator", "giling", "cetak tahu", "tahu", "tempe", "keripik"], topi: { kode: "operator_produksi", nama: "Operator produksi", tanggung_jawab: ["Menjalankan proses produksi harian", "Mencatat hasil dan bahan terpakai"] } },
  { kata: ["jahit", "penjahit", "konveksi"], topi: { kode: "penjahit", nama: "Penjahit", tanggung_jawab: ["Menjahit sesuai pola", "Memeriksa hasil jahitan"] } },
  { kata: ["sablon"], topi: { kode: "penyablon", nama: "Penyablon", tanggung_jawab: ["Menyiapkan screen", "Menyablon pesanan"] } },
  { kata: ["mebel", "furnitur", "kayu"], topi: { kode: "tukang_kayu", nama: "Tukang kayu", tanggung_jawab: ["Membuat dan merakit barang", "Finishing"] } },
  { kata: ["lele", "ikan", "tambak", "kolam"], topi: { kode: "perawat_kolam", nama: "Perawat kolam", tanggung_jawab: ["Memberi pakan", "Memeriksa air kolam", "Mencatat panen"] } },
  { kata: ["ayam", "sapi", "kambing", "ternak", "kandang"], topi: { kode: "perawat_ternak", nama: "Perawat ternak", tanggung_jawab: ["Memberi pakan", "Membersihkan kandang", "Mencatat hasil"] } },
  { kata: ["kebun", "sawah", "hidroponik", "jamur", "petani", "bibit"], topi: { kode: "pekerja_kebun", nama: "Pekerja kebun", tanggung_jawab: ["Merawat tanaman", "Memanen", "Mencatat hasil panen"] } },
  { kata: ["kursus", "les", "bimbel", "mengajar", "guru", "pelatihan", "sekolah", "paud", "mengaji"], topi: { kode: "pengajar", nama: "Pengajar", tanggung_jawab: ["Mengajar sesuai jadwal", "Mencatat kehadiran dan kemajuan murid"] } },
  { kata: ["daycare", "penitipan anak", "pengasuh"], topi: { kode: "pengasuh", nama: "Pengasuh", tanggung_jawab: ["Menjaga anak", "Mencatat kegiatan harian"] } },
  { kata: ["sopir", "driver", "truk", "angkutan"], topi: { kode: "sopir", nama: "Sopir", tanggung_jawab: ["Mengemudi sesuai rute", "Merawat kendaraan"] } },
  { kata: ["desain", "desainer", "editor", "konten"], topi: { kode: "desainer", nama: "Desainer", tanggung_jawab: ["Membuat desain sesuai brief", "Revisi dengan klien"] } },
  { kata: ["admin", "pembukuan", "keuangan"], topi: { kode: "admin_keuangan", nama: "Admin keuangan", tanggung_jawab: ["Mencatat pemasukan dan pengeluaran", "Menyiapkan tagihan"] } },
];

/** Kode topi bawaan per paket (agar topi baru tidak mengulang yang sudah dipasang paket). */
export const TOPI_BAWAAN: Partial<Record<KodePaket, string[]>> = {
  fnb: ["kasir", "pelayan", "koki", "barista", "gudang"],
  toko: ["kasir", "pramuniaga", "gudang", "sales"],
};

function normal(s: string) {
  return ` ${s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;
}
const ada = (teks: string, kata: string) => teks.includes(` ${kata} `) || (kata.length >= 5 && teks.includes(` ${kata}`));

export function cocokkanUsaha(cerita: string): HasilCocok {
  const t = normal(cerita.slice(0, 1000));
  let terbaik: { paket: KodePaket; skor: number; kata: string[] } = { paket: "kantor", skor: 0, kata: [] };
  let kedua = 0;
  for (const [paket, daftar] of Object.entries(KATA_PAKET) as [KodePaket, [string, number][]][]) {
    const kena = daftar.filter(([k]) => ada(t, k));
    const skor = kena.reduce((s, [, b]) => s + b, 0);
    if (skor > terbaik.skor) {
      kedua = terbaik.skor;
      terbaik = { paket, skor, kata: kena.map(([k]) => k) };
    } else if (skor > kedua) kedua = skor;
  }
  // Keyakinan: skor menang dan jaraknya dari paket kedua; tanpa kata kunci sama sekali = 0 (paket kantor sebagai pangkal).
  const yakin = terbaik.skor === 0 ? 0 : Math.min(0.95, 0.4 + 0.15 * terbaik.skor + 0.1 * (terbaik.skor - kedua));
  const bawaan = new Set(TOPI_BAWAAN[terbaik.paket] ?? []);
  const topi: TopiBaru[] = [];
  for (const { kata, topi: tp } of KATA_TOPI) {
    if (bawaan.has(tp.kode) || topi.some((x) => x.kode === tp.kode)) continue;
    if (kata.some((k) => ada(t, k))) topi.push(tp);
  }
  return { paket: terbaik.paket, yakin: Math.round(yakin * 100) / 100, kata: terbaik.kata, topi: topi.slice(0, 6) };
}
