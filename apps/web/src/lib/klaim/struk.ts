// M-18: pengurai teks struk dan e-struk (email atau aplikasi ojek, SPBU, parkir, tol, restoran, hotel) tanpa model.
// Aturan pasti dulu: total, tanggal, dan tebakan kategori dari kata kunci. Hasilnya hanya mengisi formulir; staf memeriksa,
// dan database tetap memeriksa batas dan aturan kategori. Korpus: fixtures/korpus/struk (diuji di struk.test.ts).

export type HasilStruk = { total: number | null; tanggal: string | null; kategori: KelompokStruk | null; pemasok: string | null };
export type KelompokStruk = "bensin" | "parkir" | "tol" | "transport" | "makan" | "hotel" | "atk" | "pulsa";

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
};

const KATA: [KelompokStruk, RegExp][] = [
  ["bensin", /\b(spbu|pertalite|pertamax|solar|dexlite|bbm|bensin|liter)\b/i],
  ["tol", /\b(tol|e-?toll|gerbang tol|gt\.)\b/i],
  ["parkir", /\b(parkir|parking)\b/i],
  ["hotel", /\b(hotel|penginapan|check-?in|kamar|room)\b/i],
  ["transport", /\b(ojek|taksi|taxi|perjalanan|trip|krl|kereta|bus|travel|tiket)\b/i],
  ["pulsa", /\b(pulsa|paket data|kuota)\b/i],
  ["atk", /\b(alat tulis|atk|fotokopi|fotocopy|kertas hvs|tinta printer)\b/i],
  ["makan", /\b(resto|restoran|rumah makan|kopi|makan|warung|cafe|kafe|nasi|minuman)\b/i],
];

/** "Rp 45.000", "IDR 45,000", "45.000,00", "Rp45.500" -> rupiah bulat. */
export function angkaRupiah(s: string): number | null {
  const m = s.replace(/\s/g, "").match(/(?:rp|idr)?\.?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{2}))?(?!\d)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tanggalDari(teks: string): string | null {
  const iso = teks.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = teks.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/);
  if (dmy) {
    const th = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return sah(Number(th), Number(dmy[2]), Number(dmy[1]));
  }
  const teksBulan = teks.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(20\d{2})\b/i);
  if (teksBulan && BULAN[teksBulan[2].toLowerCase()]) return sah(Number(teksBulan[3]), BULAN[teksBulan[2].toLowerCase()], Number(teksBulan[1]));
  return null;
}

function sah(th: number, bl: number, hr: number): string | null {
  const d = new Date(Date.UTC(th, bl - 1, hr));
  if (d.getUTCFullYear() !== th || d.getUTCMonth() !== bl - 1 || d.getUTCDate() !== hr) return null;
  return d.toISOString().slice(0, 10);
}

/** Baris total: prioritas total bayar/grand total/dibayar, lalu total, lalu tarif; subtotal, diskon, kembalian, tunai, dan saldo diabaikan. */
function totalDari(baris: string[]): number | null {
  const kuat = /(grand\s*total|total\s*(bayar|pembayaran|tagihan|harga)|jumlah\s*(bayar|dibayar)|anda\s*membayar|total\s*dibayar|dibayar)/i;
  const lemah = /\b(total|jumlah)\b/i;
  const tarif = /\b(tarif|harga)\b/i; // struk tol dan karcis hanya menulis tarif
  const buang = /(sub\s*-?\s*total|diskon|potongan|kembali|kembalian|tunai|cash|ppn|pajak|poin|hemat|saldo|\/\s*liter)/i;
  for (const pola of [kuat, lemah, tarif]) {
    let hasil: number | null = null;
    for (let i = 0; i < baris.length; i++) {
      const b = baris[i];
      if (!pola.test(b) || buang.test(b)) continue;
      const n = angkaRupiah(b.replace(pola, " ")) ?? (baris[i + 1] ? angkaRupiah(baris[i + 1]) : null);
      if (n) hasil = n;
    }
    if (hasil) return hasil;
  }
  return null;
}

/** Pemasok: baris pertama (dari 4 teratas) dengan minimal 3 huruf yang bukan alamat, tanggal, atau label; nama toko dicetak paling atas. */
function pemasokDari(baris: string[]): string | null {
  const bukan = /^(jl\.?|jalan|no\.?|tel|telp|npwp|kasir|tanggal|waktu|struk|nota|invoice|kuitansi|receipt)\b/i;
  for (const b of baris.slice(0, 4)) {
    const huruf = b.replace(/[^a-z]/gi, "").length;
    if (huruf >= 3 && !bukan.test(b) && !/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(b)) return b.replace(/\s+/g, " ").slice(0, 80);
  }
  return null;
}

export function bacaStruk(teks: string): HasilStruk {
  const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  const kategori = KATA.find(([, re]) => re.test(teks))?.[0] ?? null;
  return { total: totalDari(baris), tanggal: tanggalDari(teks), kategori, pemasok: pemasokDari(baris) };
}

/** Pilih kategori usaha yang namanya cocok dengan kelompok tebakan (misalnya kategori "Bensin dan tol" untuk bensin). */
export function cocokKategori(kelompok: KelompokStruk | null, kategori: { id: string; nama: string }[]): string | null {
  if (!kelompok) return null;
  const kunci: Record<KelompokStruk, RegExp> = {
    bensin: /bensin|bbm|bahan bakar/i, parkir: /parkir/i, tol: /tol/i, transport: /transport|ojek|taksi|perjalanan/i,
    makan: /makan|konsumsi|minum/i, hotel: /hotel|penginapan|inap/i, atk: /atk|alat tulis|kantor/i, pulsa: /pulsa|internet|komunikasi/i,
  };
  return kategori.find((k) => kunci[kelompok].test(k.nama))?.id ?? null;
}
