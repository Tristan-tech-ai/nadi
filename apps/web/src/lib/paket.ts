// Paket harga Nadi (docs/bisnis/paket.md, model docs/bisnis/model.xlsx). Harga rencana per bulan tanpa PPN;
// selama masa uji belum ada tagihan. Satu sumber untuk landing dan halaman /harga.
export type Paket = {
  kode: "gratis" | "usaha" | "tumbuh" | "perusahaan";
  nama: string;
  harga: number;
  mulaiDari?: boolean;
  orang: number;
  perOrangTambahan: number | null;
  berkasPerBulan: number | null;
  isi: string[];
};

export const PAKET: Paket[] = [
  { kode: "gratis", nama: "Gratis", harga: 0, orang: 5, perOrangTambahan: null, berkasPerBulan: 100,
    isi: ["1 usaha", "Lempar Saja dan Feed Keputusan", "Absen QR dan izin", "Invoice dengan QRIS"] },
  { kode: "usaha", nama: "Usaha", harga: 149000, orang: 15, perOrangTambahan: 5000, berkasPerBulan: 1000,
    isi: ["Semua di Gratis", "Gaji, PPh 21, BPJS, dan Gerbang Gaji", "Izin otomatis dan jadwal shift", "Sarapan Data dan Ruang Akuntan"] },
  { kode: "tumbuh", nama: "Tumbuh", harga: 349000, orang: 50, perOrangTambahan: 5000, berkasPerBulan: 5000,
    isi: ["Semua di Usaha", "Banyak cabang", "Mata dan Peta Usaha", "Rekrut dan wawancara suara", "Kompas Pajak dan cocok mutasi", "Sambungan ke asisten AI milikmu (MCP)"] },
  { kode: "perusahaan", nama: "Perusahaan", harga: 1500000, mulaiDari: true, orang: 150, perOrangTambahan: 4000, berkasPerBulan: null,
    isi: ["Semua di Tumbuh", "Masuk dengan akun kantor (SSO)", "Ekspor audit", "Dukungan prioritas dan kontrak tahunan"] },
];

/** Harga per bulan untuk n orang (tanpa diskon tahunan). Null bila melebihi batas paket Gratis. */
export function hargaBulanan(p: Paket, orang: number): number | null {
  if (orang <= p.orang) return p.harga;
  if (p.perOrangTambahan === null) return null;
  return p.harga + (orang - p.orang) * p.perOrangTambahan;
}

export const DISKON_TAHUNAN_BULAN = 2;
