// PPh Pasal 21 pegawai tetap (PMK 168/2023, tabel TER di Lampiran PP 58/2023; docs/research/gaji.md). Murni: tabel dan tarif
// datang dari aturan bertanggal, tidak ditulis di sini. Semua uang dalam rupiah bulat.

/** Baris TER: [batas bawah (eksklusif, kecuali 0), batas atas inklusif atau null, tarif persen]. */
export type BarisTer = [number, number | null, number];
export type TabelTer = { A: BarisTer[]; B: BarisTer[]; C: BarisTer[] };
/** Lapisan Pasal 17: [batas atas PKP kumulatif atau null, tarif persen]. */
export type LapisanP17 = [number | null, number][];
export type Ptkp = { diri: number; kawin: number; per_tanggungan: number; maks_tanggungan: number };
export type KategoriTer = "A" | "B" | "C";

const POLA_STATUS = /^(TK|K)\/([0-3])$/;

/** Kategori TER menurut status PTKP (PP 58/2023 Pasal 2): TK/0, TK/1, K/0 = A; TK/2, TK/3, K/1, K/2 = B; K/3 = C. */
export function kategoriTer(status: string, peta: Record<string, string>): KategoriTer {
  const k = peta[status];
  if (k !== "A" && k !== "B" && k !== "C") throw new Error(`Status PTKP tidak dikenal: ${status}`);
  return k;
}

/** PTKP setahun: diri + tambahan kawin + tanggungan (paling banyak 3). */
export function ptkpSetahun(status: string, p: Ptkp): number {
  const m = POLA_STATUS.exec(status);
  if (!m) throw new Error(`Status PTKP tidak dikenal: ${status}`);
  return p.diri + (m[1] === "K" ? p.kawin : 0) + Math.min(Number(m[2]), p.maks_tanggungan) * p.per_tanggungan;
}

/** Tarif TER (persen) untuk bruto sebulan: "di atas batas bawah sampai dengan batas atas". */
export function tarifTer(bruto: number, baris: BarisTer[]): number {
  for (const [bawah, atas, tarif] of baris) {
    if ((bruto > bawah || bawah === 0) && (atas === null || bruto <= atas)) return tarif;
  }
  throw new Error(`Bruto di luar tabel TER: ${bruto}`);
}

/** Persen x nilai dengan aritmetika bulat (tarif sampai dua desimal); sisa pecahan rupiah dibuang. */
export function persenDari(nilai: number, persen: number): number {
  return Math.floor((nilai * Math.round(persen * 100)) / 10_000);
}

/** PPh 21 masa selain masa terakhir: TER x bruto sebulan. */
export function pph21Bulanan(bruto: number, status: string, tabel: TabelTer, peta: Record<string, string>) {
  const kategori = kategoriTer(status, peta);
  const tarif = tarifTer(bruto, tabel[kategori]);
  return { kategori, tarif, pph: persenDari(bruto, tarif) };
}

/** PPh terutang setahun dengan tarif Pasal 17 atas PKP (dibulatkan ke bawah ribuan). */
export function pph17(pkp: number, lapisan: LapisanP17): number {
  let sisa = Math.max(0, Math.floor(pkp / 1000) * 1000);
  let bawah = 0;
  let pajak = 0;
  for (const [atas, tarif] of lapisan) {
    if (sisa <= 0) break;
    const lebar = atas === null ? sisa : Math.min(sisa, atas - bawah);
    pajak += persenDari(lebar, tarif);
    sisa -= lebar;
    if (atas !== null) bawah = atas;
  }
  return pajak;
}

export type MasukanMasaTerakhir = {
  status: string;
  /** Jumlah penghasilan bruto pada tahun berjalan di pemberi kerja ini (termasuk masa terakhir). */
  brutoSetahun: number;
  /** Jumlah bulan bekerja di tahun berjalan (untuk batas biaya jabatan Rp500.000 per bulan). */
  bulan: number;
  /** Iuran pensiun/JHT/JP yang dibayar pegawai lewat pemberi kerja, setahun. */
  iuranPegawai?: number;
  /** Zakat atau sumbangan keagamaan wajib lewat pemberi kerja, setahun. */
  zakat?: number;
  /** PPh 21 yang sudah dipotong pada masa sebelumnya di tahun ini. */
  sudahDipotong: number;
  /** Neto disetahunkan (subjek pajak dalam negeri baru/berakhir di tengah tahun, PMK 168 Pasal 15 ayat (3)). */
  disetahunkan?: boolean;
};

/** PPh 21 masa terakhir (Desember atau bulan berhenti): Pasal 17 setahun dikurangi yang sudah dipotong. Negatif = lebih potong. */
export function pph21MasaTerakhir(m: MasukanMasaTerakhir, aturan: { ptkp: Ptkp; pasal17: LapisanP17 }) {
  const biayaJabatan = Math.min(persenDari(m.brutoSetahun, 5), 500_000 * m.bulan, 6_000_000);
  const neto = m.brutoSetahun - biayaJabatan - (m.iuranPegawai ?? 0) - (m.zakat ?? 0);
  const ptkp = ptkpSetahun(m.status, aturan.ptkp);
  const netoDasar = m.disetahunkan ? Math.floor((neto * 12) / m.bulan) : neto;
  const pkp = Math.max(0, Math.floor((netoDasar - ptkp) / 1000) * 1000);
  const setahunPenuh = pph17(pkp, aturan.pasal17);
  const terutang = m.disetahunkan ? Math.floor((setahunPenuh * m.bulan) / 12) : setahunPenuh;
  return { biayaJabatan, neto, ptkp, pkp, pphSetahun: terutang, pphMasaTerakhir: terutang - m.sudahDipotong };
}
