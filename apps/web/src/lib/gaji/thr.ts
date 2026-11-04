// M-10: THR Keagamaan menurut Permenaker 6/2016 (peraturan.bpk.go.id/Download/252116, dibaca 5 Nov 2026).
// Pasal 2 ayat (1): berhak bila masa kerja >= 1 bulan terus menerus. Pasal 3 ayat (1): >= 12 bulan = 1 bulan upah; 1 s.d. < 12 bulan
// = masa kerja / 12 x 1 bulan upah. Ayat (2) huruf b: upah = upah pokok + tunjangan tetap. Pasal 5 ayat (4): dibayar paling lambat
// 7 hari sebelum Hari Raya. Masa kerja dihitung dalam bulan penuh sampai Hari Raya, sama dengan app.masa_kerja_bulan di database
// (database tetap penghitung yang dipercaya: public.hitung_thr).

/** Bulan penuh dari `mulai` sampai `sampai` (YYYY-MM-DD), seperti age() Postgres. */
export function masaKerjaBulan(mulai: string, sampai: string): number {
  const [y1, m1, d1] = mulai.split("-").map(Number);
  const [y2, m2, d2] = sampai.split("-").map(Number);
  if (sampai < mulai) return 0;
  let bulan = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) bulan -= 1;
  return Math.max(0, bulan);
}

export function hitungThr(p: { mulai: string; hariRaya: string; pokok: number; tunjanganTetap?: number }) {
  const upah = p.pokok + (p.tunjanganTetap ?? 0);
  const masa = masaKerjaBulan(p.mulai, p.hariRaya);
  const thr = masa < 1 ? 0 : masa >= 12 ? upah : Math.round((masa * upah) / 12);
  const batas = new Date(`${p.hariRaya}T00:00:00Z`);
  batas.setUTCDate(batas.getUTCDate() - 7);
  return { masa, upah, thr, batasBayar: batas.toISOString().slice(0, 10) };
}

/**
 * M-10B: upah sebulan untuk pekerja harian lepas (Permenaker 6/2016 Pasal 3 ayat (3)): masa kerja >= 12 bulan = rata-rata upah
 * 12 bulan terakhir sebelum Hari Raya (jumlah dibagi 12, bulan tanpa kerja ikut terhitung); < 12 bulan = rata-rata upah tiap bulan
 * selama masa kerja (jumlah dibagi banyak bulan yang ada upahnya). `upahBulanan` = pokok + tunjangan tetap slip yang disetujui.
 */
export function hitungThrHarianLepas(p: { mulai: string; hariRaya: string; upahBulanan: number[] }) {
  const masa = masaKerjaBulan(p.mulai, p.hariRaya);
  const jumlah = p.upahBulanan.reduce((s, x) => s + x, 0);
  if (!p.upahBulanan.length) return { masa, upah: null, thr: null };
  const upah = masa >= 12 ? jumlah / 12 : jumlah / p.upahBulanan.length;
  const thr = masa < 1 ? 0 : masa >= 12 ? Math.round(upah) : Math.round((masa * upah) / 12);
  return { masa, upah, thr };
}
