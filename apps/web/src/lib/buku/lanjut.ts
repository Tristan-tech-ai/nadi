// M-08: bentuk data RPC akuntansi lanjutan (supabase/migrations/20261105076000_akuntansi_lanjutan.sql) dan hitungan kecil di klien.

export type BarisAnggaran = { kode: string; nama: string; golongan: "pendapatan" | "beban"; anggaran: number; realisasi: number; selisih: number; persen: number | null };
export type LaporanAnggaran = {
  baris: BarisAnggaran[];
  pendapatan: { anggaran: number; realisasi: number };
  beban: { anggaran: number; realisasi: number };
  laba: { anggaran: number; realisasi: number };
};
export type BarisDimensi = { dimensi: string | null; nama: string | null; pendapatan: number; beban: number; laba: number };
export type LaporanDimensi = { jenis: "cabang" | "proyek"; baris: BarisDimensi[] };
export type Konsolidasi = {
  usaha: { id: string; nama: string }[];
  neraca: { baris: { kode: string; nama: string; golongan: string; saldo: number }[]; aset: number; kewajiban: number; modal: number; laba_belum_ditutup: number; seimbang: boolean };
  laba_rugi: { baris: { kode: string; nama: string; golongan: string; nilai: number }[]; pendapatan: number; beban: number; laba: number };
  eliminasi: { jurnal: number; nilai: number };
};
export type Kurs = { valuta: string; kurs: number; per: number; sumber: string; berlaku_dari: string; berlaku_sampai: string | null; resmi: boolean };

/** Kurs yang berlaku pada `tanggal` per valuta (sama dengan public.fx_rate_on): berlaku_dari terbaru, seri dimenangkan kurs usaha. */
export function kursBerlaku(daftar: Kurs[], tanggal: string): Map<string, Kurs> {
  const hasil = new Map<string, Kurs>();
  const urut = [...daftar]
    .filter((k) => k.berlaku_dari <= tanggal && (!k.berlaku_sampai || k.berlaku_sampai >= tanggal))
    .sort((a, b) => (a.berlaku_dari === b.berlaku_dari ? Number(a.resmi) - Number(b.resmi) : a.berlaku_dari < b.berlaku_dari ? 1 : -1));
  for (const k of urut) if (!hasil.has(k.valuta)) hasil.set(k.valuta, k);
  return hasil;
}

/** Jumlah valuta ke rupiah dibulatkan (kurs per `per` unit, mis. JPY per 100 yen). Null bila jumlah tidak sah. */
export function keRupiah(jumlah: number, k: Pick<Kurs, "kurs" | "per">): number | null {
  if (!Number.isFinite(jumlah) || jumlah < 0 || jumlah > 1e12) return null;
  return Math.round((jumlah * k.kurs) / k.per);
}

/** Jumlah valuta dari isian: titik atau koma desimal, tanpa pemisah ribuan ganda (12.500,50 atau 12500.5). */
export function angkaValuta(t: string): number | null {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d+([.,]\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return null;
}

/** Bulan isian YYYY-MM menjadi tanggal pertama bulan itu; kosong/rusak = null. */
export function bulanKeTanggal(b: unknown): string | null {
  return typeof b === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(b) ? `${b}-01` : null;
}

/** Jurnal berulang dua baris (debit satu akun, kredit satu akun) untuk RPC save_recurring_journal. */
export function barisBerulang(debit: string, kredit: string, jumlah: number): { akun: string; debit?: number; kredit?: number }[] | null {
  if (!debit || !kredit || debit === kredit || !Number.isInteger(jumlah) || jumlah <= 0) return null;
  return [{ akun: debit, debit: jumlah }, { akun: kredit, kredit: jumlah }];
}

/** Daftar id usaha dari parameter ?grup=a,b (hanya uuid, tanpa ganda, paling banyak 10). */
export function bacaGrup(g: unknown): string[] {
  if (typeof g !== "string") return [];
  return [...new Set(g.split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 10);
}
