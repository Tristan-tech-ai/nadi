// M-18B: mode struk baca-berkas. Dipanggil layar Klaim hanya bila OCR di perangkat tidak cukup yakin (< 85) atau total tidak
// terbaca aturan. Mengembalikan pemasok, tanggal, total, keyakinan; TIDAK membuat usulan nota (klaim sendiri yang menjadi
// usulan setelah staf memeriksa angkanya). Keluaran model = masukan tak tepercaya: dirapikan dan dibatasi di sini.

export const INSTRUKSI_STRUK = `Kamu membaca foto struk atau kuitansi belanja di Indonesia untuk klaim penggantian biaya karyawan.
Isi skema:
- pemasok: nama toko, SPBU, restoran, hotel, atau operator jalan tol seperti tercetak di bagian atas struk. Kosongkan bila tidak terbaca.
- tanggal: tanggal transaksi dalam format YYYY-MM-DD. Kosongkan bila tidak terbaca.
- total: jumlah yang dibayar dalam rupiah, bilangan bulat tanpa titik. Pakai baris total bayar atau grand total, bukan subtotal, tunai, kembalian, atau saldo kartu. 0 bila tidak terbaca.
- keyakinan: 0 sampai 1, seberapa yakin total yang kamu tulis sama dengan yang tercetak.
Jangan menebak angka yang tidak terbaca.`;

export const SKEMA_STRUK = {
  type: "object",
  properties: {
    pemasok: { type: "string" },
    tanggal: { type: "string" },
    total: { type: "integer" },
    keyakinan: { type: "number" },
  },
  required: ["pemasok", "tanggal", "total", "keyakinan"],
  additionalProperties: false,
} as const;

export type HasilStruk = { pemasok: string | null; tanggal: string | null; total: number | null; keyakinan: number };

/** Rapikan jawaban model: pemasok <= 80 huruf tanpa karakter kendali, tanggal sah 2000-2099, total 1..100.000.000. */
export function rapikanStruk(mentah: unknown): HasilStruk {
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  const pemasok = typeof m.pemasok === "string" ? m.pemasok.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const tg = typeof m.tanggal === "string" ? m.tanggal.trim() : "";
  let tanggal: string | null = null;
  const t = tg.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (t) {
    const d = new Date(Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3])));
    if (d.getUTCMonth() === Number(t[2]) - 1 && d.getUTCDate() === Number(t[3])) tanggal = `${t[1]}-${t[2]}-${t[3]}`;
  }
  const n = typeof m.total === "number" && Number.isInteger(m.total) ? m.total : 0;
  const k = typeof m.keyakinan === "number" && Number.isFinite(m.keyakinan) ? Math.min(1, Math.max(0, m.keyakinan)) : 0;
  return { pemasok: pemasok || null, tanggal, total: n >= 1 && n <= 100_000_000 ? n : null, keyakinan: Math.round(k * 100) / 100 };
}
