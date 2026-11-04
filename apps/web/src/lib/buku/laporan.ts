// M-01 laporan keuangan: bentuk data RPC laporan_keuangan/buku_besar/umur_piutang dan fungsi murni untuk tampilan dan ekspor.
// Semua angka dihitung di database (supabase/migrations/20261104054000_laporan_keuangan.sql); di sini hanya penyusun baris.

export const JENIS_LAPORAN = ["neraca", "laba_rugi", "arus_kas", "neraca_saldo", "buku_besar", "umur_piutang"] as const;
export type JenisLaporan = (typeof JENIS_LAPORAN)[number];

export type BarisAkun = { kode: string; nama: string; golongan: "aset" | "kewajiban" | "modal" | "pendapatan" | "beban" };
export type Laporan = {
  dari: string;
  sampai: string;
  neraca: { baris: (BarisAkun & { saldo: number })[]; aset: number; kewajiban: number; modal: number; laba_belum_ditutup: number; seimbang: boolean };
  laba_rugi: { baris: (BarisAkun & { nilai: number })[]; pendapatan: number; beban: number; laba: number };
  arus_kas: { laba: number; operasi: number; investasi: number; pendanaan: number; kas_awal: number; kas_akhir: number; cocok: boolean };
  neraca_saldo: (BarisAkun & { saldo_normal: string; awal: number; debit: number; kredit: number; akhir: number })[];
};
export type BukuBesar = {
  kode: string;
  nama: string;
  awal: number;
  akhir: number;
  baris: { tanggal: string; keterangan: string; sumber: string; debit: number; kredit: number; saldo: number }[];
};
export type KelompokUmur = "belum" | "h1_30" | "h31_60" | "h61_90" | "lebih_90";
export type UmurPiutang = {
  per: string;
  baris: { nomor: string; pelanggan: string; total: number; tanggal: string; jatuh_tempo: string; hari: number; kelompok: KelompokUmur }[];
  kelompok: Record<KelompokUmur | "total", number>;
};

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Rentang dari parameter URL; bawaan 1 Januari tahun ini sampai hari ini. Tanggal rusak diganti bawaan, dari > sampai ditukar. */
export function bacaRentang(dari: unknown, sampai: unknown, hariIni: string): { dari: string; sampai: string } {
  const d = typeof dari === "string" && TANGGAL.test(dari) && !Number.isNaN(Date.parse(dari)) ? dari : `${hariIni.slice(0, 4)}-01-01`;
  const s = typeof sampai === "string" && TANGGAL.test(sampai) && !Number.isNaN(Date.parse(sampai)) ? sampai : hariIni;
  return d <= s ? { dari: d, sampai: s } : { dari: s, sampai: d };
}

export function bacaJenis(j: unknown): JenisLaporan {
  return (JENIS_LAPORAN as readonly string[]).includes(String(j)) ? (j as JenisLaporan) : "neraca";
}

/** Saldo awal dari isian per akun: angka positif = saldo di sisi normal akun; negatif = sisi sebaliknya. */
export function barisSaldoAwal(isian: { kode: string; saldo_normal: string; nilai: number }[]): { akun: string; debit?: number; kredit?: number }[] {
  return isian
    .filter((x) => Number.isFinite(x.nilai) && Math.trunc(x.nilai) !== 0)
    .map((x) => {
      const n = Math.trunc(x.nilai);
      const debit = (x.saldo_normal === "debit") === n > 0;
      return debit ? { akun: x.kode, debit: Math.abs(n) } : { akun: x.kode, kredit: Math.abs(n) };
    });
}

/** Angka rupiah dari isian formulir: "1.250.000", "1250000", "-500.000". Kosong = 0, rusak = null. */
export function angkaIsian(t: string): number | null {
  const s = t.replace(/\s|Rp/gi, "");
  if (s === "") return 0;
  if (!/^-?\d{1,3}(\.\d{3})*$|^-?\d+$/.test(s)) return null;
  return Number(s.replace(/\./g, ""));
}

const kutip = (v: string | number) => {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (pemisah titik koma, cocok Excel berlokal Indonesia) untuk satu laporan. Angka rupiah bulat tanpa pemisah ribuan. */
export function csvLaporan(jenis: JenisLaporan, data: { laporan?: Laporan; buku?: BukuBesar; umur?: UmurPiutang }, kolom: Record<string, string>): string {
  const baris: (string | number)[][] = [];
  const L = data.laporan;
  if (jenis === "neraca" && L) {
    baris.push([kolom.kode, kolom.akun, kolom.golongan, kolom.saldo]);
    for (const b of L.neraca.baris) baris.push([b.kode, b.nama, b.golongan, b.saldo]);
    baris.push(["", kolom.labaBelumDitutup, "modal", L.neraca.laba_belum_ditutup]);
    baris.push(["", kolom.totalAset, "", L.neraca.aset]);
    baris.push(["", kolom.totalKewajibanModal, "", L.neraca.kewajiban + L.neraca.modal + L.neraca.laba_belum_ditutup]);
  } else if (jenis === "laba_rugi" && L) {
    baris.push([kolom.kode, kolom.akun, kolom.golongan, kolom.nilai]);
    for (const b of L.laba_rugi.baris) baris.push([b.kode, b.nama, b.golongan, b.nilai]);
    baris.push(["", kolom.laba, "", L.laba_rugi.laba]);
  } else if (jenis === "arus_kas" && L) {
    const a = L.arus_kas;
    baris.push([kolom.akun, kolom.nilai], [kolom.kasAwal, a.kas_awal], [kolom.operasi, a.operasi], [kolom.investasi, a.investasi],
      [kolom.pendanaan, a.pendanaan], [kolom.kasAkhir, a.kas_akhir]);
  } else if (jenis === "neraca_saldo" && L) {
    baris.push([kolom.kode, kolom.akun, kolom.golongan, kolom.awal, kolom.debit, kolom.kredit, kolom.akhir]);
    for (const b of L.neraca_saldo) baris.push([b.kode, b.nama, b.golongan, b.awal, b.debit, b.kredit, b.akhir]);
  } else if (jenis === "buku_besar" && data.buku) {
    const B = data.buku;
    baris.push([kolom.tanggal, kolom.keterangan, kolom.debit, kolom.kredit, kolom.saldo], ["", kolom.saldoAwal, "", "", B.awal]);
    for (const b of B.baris) baris.push([b.tanggal, b.keterangan, b.debit, b.kredit, b.saldo]);
  } else if (jenis === "umur_piutang" && data.umur) {
    baris.push([kolom.nomor, kolom.pelanggan, kolom.jatuhTempo, kolom.hari, kolom.nilai]);
    for (const b of data.umur.baris) baris.push([b.nomor, b.pelanggan, b.jatuh_tempo, b.hari, b.total]);
  }
  return baris.map((r) => r.map(kutip).join(";")).join("\r\n") + "\r\n";
}
