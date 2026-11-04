// B-EKSIM2 (docs/research/ekspor-impor.md): perkiraan biaya mendarat impor, murni (tanpa jaringan). Bukan billing resmi.
// - Nilai pabean CIF (harga barang + ongkos kirim + asuransi, USD) x kurs pajak = CIF rupiah.
// - Bea masuk = tarif isian pengguna (dari BTKI/INSW, ad valorem) x CIF rupiah. Bea masuk tambahan, antidumping, dan tarif
//   spesifik belum dihitung.
// - Nilai impor = CIF + bea masuk (PMK 51/2025 Pasal 3 ayat (2)); dasar PPh 22 impor (Pasal 3 ayat (1) huruf a angka 1) dan PPN
//   impor (PMK 131/2024: 12% x 11/12 untuk barang bukan mewah, 12% penuh untuk barang mewah). PPnBM tidak dihitung.
// Persen dihitung lewat basis poin bulat supaya 2,5% tidak kena galat pecahan; pembulatan ke rupiah terdekat (billing bisa beda).

export type Kelompok = "umum" | "tertentu" | "tertentu_lain" | "kedelai_gandum_terigu" | "emas_batangan";
export type AturanImpor = {
  pph22: { dengan_api_persen: number; tanpa_api_persen: number; barang_tertentu_persen: number; barang_tertentu_lain_persen: number; kedelai_gandum_terigu_api_persen: number; emas_batangan_persen: number };
  ppn: { tarif_persen: number; dpp_pengali: [number, number] };
};
export type MasukImpor = {
  fobSen: number; ongkirSen: number; asuransiSen: number; kurs: number; bmPersen: number; kelompok: Kelompok; api: boolean; mewah: boolean; biayaLain: number;
};
export type HasilImpor = {
  cifSen: number; cifRp: number; bm: number; nilaiImpor: number; ppn: number; pph22: number; tarifPph22: number;
  pajak: number; uangKeluar: number; biayaMendarat: number;
};

export const KELOMPOK: Kelompok[] = ["umum", "tertentu", "tertentu_lain", "kedelai_gandum_terigu", "emas_batangan"];

/** Tarif PPh 22 impor (persen) menurut PMK 51/2025 Pasal 3 ayat (1) huruf a angka 1 huruf a) sampai f). */
export function tarifPph22(k: Kelompok, api: boolean, a: AturanImpor["pph22"]): number {
  switch (k) {
    case "tertentu": return a.barang_tertentu_persen;
    case "tertentu_lain": return a.barang_tertentu_lain_persen;
    case "emas_batangan": return a.emas_batangan_persen;
    case "kedelai_gandum_terigu": return api ? a.kedelai_gandum_terigu_api_persen : a.tanpa_api_persen;
    default: return api ? a.dengan_api_persen : a.tanpa_api_persen;
  }
}

const bp = (persen: number) => Math.round(persen * 100);
const kali = (rupiah: number, persen: number) => Math.round((rupiah * bp(persen)) / 10_000);
const sah = (n: number) => Number.isFinite(n) && n >= 0;

export function hitungImpor(m: MasukImpor, a: AturanImpor): HasilImpor | null {
  if (![m.fobSen, m.ongkirSen, m.asuransiSen, m.kurs, m.bmPersen, m.biayaLain].every(sah) || m.bmPersen > 200 || m.kurs < 1000) return null;
  const cifSen = Math.round(m.fobSen) + Math.round(m.ongkirSen) + Math.round(m.asuransiSen);
  if (cifSen <= 0) return null;
  const cifRp = Math.round((cifSen * m.kurs) / 100);
  const bm = kali(cifRp, m.bmPersen);
  const nilaiImpor = cifRp + bm;
  const [p0, p1] = a.ppn.dpp_pengali;
  const ppn = m.mewah ? kali(nilaiImpor, a.ppn.tarif_persen) : Math.round((nilaiImpor * bp(a.ppn.tarif_persen) * p0) / (10_000 * p1));
  const tarif = tarifPph22(m.kelompok, m.api, a.pph22);
  const pph22 = kali(nilaiImpor, tarif);
  const pajak = bm + ppn + pph22;
  const biayaLain = Math.round(m.biayaLain);
  return { cifSen, cifRp, bm, nilaiImpor, ppn, pph22, tarifPph22: tarif, pajak, uangKeluar: cifRp + pajak + biayaLain, biayaMendarat: cifRp + bm + biayaLain };
}
