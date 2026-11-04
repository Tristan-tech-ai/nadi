// F3-07E (docs/research/serah-terima-sql.md, docs/research/upah-harian.md): hak keuangan orang yang berhenti, murni (tanpa jaringan).
// - Upah sehari = (pokok + tunjangan tetap) / 25 pola 6 hari atau / 21 pola 5 hari (PP 36/2021 Pasal 17), pembagi dari aturan
//   bertanggal upah.pembagi_harian. Aturan penggantian cuti tidak menyebut pembagi, jadi angka ini saran yang bisa diubah pemilik.
// - Gaji bulan terakhir = slip susunSlip dengan pokok dan tunjangan tetap dikali hari kerja (1 s.d. tanggal efektif) / pembagi,
//   paling banyak sebulan penuh. Hari libur nasional belum dikurangi.
// - Sisa cuti = jatah tahunan - cuti disetujui tahun itu, hanya bila jatah diatur (PP 35/2021 Pasal 40 ayat (4) huruf a).
// - Mengundurkan diri tidak mendapat pesangon (PP 35/2021 Pasal 50); alasan lain belum dihitung di sini.
import { susunSlip, type DataGaji, type Komponen, type PetaAturan } from "@/lib/gaji/susun";

export type Pola = "6_hari" | "5_hari";
export type MasukHak = {
  gaji: DataGaji | null; pola: Pola; pembagi: { pola_6_hari: number; pola_5_hari: number } | null; tanggalEfektif: string;
  jatahCuti: number | null; cutiTerpakai: number; alasan: string;
};
export type HasilHak = {
  upahSebulan: number | null; upahHarian: number | null; pembagi: number | null; hariKerja: number; faktor: number | null;
  gajiAkhir: { bruto: number; potongan: number; neto: number; komponen: Komponen[]; peringatan: string[] } | null;
  cuti: { jatah: number; terpakai: number; sisa: number; nilai: number | null } | null;
  pesangon: "tidak_berlaku" | "belum_dihitung";
};

/** Hari kerja dari tanggal 1 bulan itu sampai tanggal (termasuk): Minggu libur, Sabtu juga libur untuk pola 5 hari. */
export function hariKerjaSampai(tanggal: string, pola: Pola): number {
  const [y, m, d] = tanggal.split("-").map(Number);
  let n = 0;
  for (let i = 1; i <= d; i++) {
    const hari = new Date(Date.UTC(y, m - 1, i)).getUTCDay();
    if (hari === 0 || (pola === "5_hari" && hari === 6)) continue;
    n++;
  }
  return n;
}

export function hitungHak(m: MasukHak, aturan: PetaAturan): HasilHak {
  const pembagi = m.pembagi ? (m.pola === "5_hari" ? m.pembagi.pola_5_hari : m.pembagi.pola_6_hari) : null;
  const upahSebulan = m.gaji ? m.gaji.pokok + (m.gaji.tunjangan_tetap ?? 0) : null;
  const upahHarian = upahSebulan !== null && pembagi ? Math.round(upahSebulan / pembagi) : null;
  const hariKerja = hariKerjaSampai(m.tanggalEfektif, m.pola);
  const faktor = pembagi ? Math.min(1, hariKerja / pembagi) : null;
  let gajiAkhir: HasilHak["gajiAkhir"] = null;
  if (m.gaji && faktor !== null) {
    const g: DataGaji = { ...m.gaji, pokok: Math.round(m.gaji.pokok * faktor), tunjangan_tetap: Math.round((m.gaji.tunjangan_tetap ?? 0) * faktor) };
    const bulan = Number(m.tanggalEfektif.slice(5, 7));
    const s = susunSlip(g, aturan, bulan);
    const bruto = s.komponen.filter((k) => k.jenis === "pendapatan").reduce((a, k) => a + k.nilai, 0);
    const potongan = s.komponen.filter((k) => k.jenis === "potongan").reduce((a, k) => a + k.nilai, 0);
    gajiAkhir = { bruto, potongan, neto: bruto - potongan, komponen: s.komponen, peringatan: s.peringatan };
  }
  const cuti = m.jatahCuti === null ? null : (() => {
    const sisa = Math.max(0, m.jatahCuti - m.cutiTerpakai);
    return { jatah: m.jatahCuti, terpakai: m.cutiTerpakai, sisa, nilai: upahHarian === null ? null : sisa * upahHarian };
  })();
  return { upahSebulan, upahHarian, pembagi, hariKerja, faktor, gajiAkhir, cuti, pesangon: m.alasan === "mundur" ? "tidak_berlaku" : "belum_dihitung" };
}
