// M-22 pengurai pertanyaan: kalimat sehari-hari (Indonesia, sebagian Inggris) menjadi satu niat dari daftar tetap RPC ask_data
// plus rentang tanggal, tanpa model dan tanpa SQL bebas. Pertanyaan yang meminta pendapat, sebab, atau ramalan ditolak (null)
// supaya Nadi tidak menjawab dengan angka yang tidak menjawab pertanyaannya.

// T-01A: berkas ini disalin persis ke supabase/functions/pelajari-tanya/urai.ts (tes src/lib/tanya/salinan.test.ts memeriksa sama),
// supaya pengawas di Edge Function mencoba aturan baru dengan pengurai yang sama dengan aplikasi.
export const NIAT_DAFTAR = ["pendapatan", "beban", "laba", "kas", "piutang", "piutang_lewat", "hutang", "invoice_terbit", "karyawan", "hadir", "lembur", "gaji", "stok"] as const;
export type Niat = (typeof NIAT_DAFTAR)[number];
export type Tanya = { niat: Niat; dari: string; sampai: string; cari?: string; aturan?: string };
/** Aturan hasil belajar (tanya_aturan berstatus aktif): kata kunci di kalimat menunjuk satu niat tetap. */
export type AturanTanya = { id?: string; kata: string; niat: Niat };

const BULAN: Record<string, number> = {
  januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, maret: 3, mar: 3, march: 3, april: 4, apr: 4, mei: 5, may: 5, juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7, agustus: 8, agu: 8, agt: 8, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11, desember: 12, des: 12, december: 12, dec: 12,
};

// Urutan penting: yang lebih khusus lebih dulu (gaji sebelum karyawan dan biaya, hutang pemasok sebelum tagihan, lewat jatuh tempo sebelum piutang).
const NIAT: [Niat, RegExp][] = [
  ["gaji", /\b(gaji|payroll|upah|salary|salaries)\b/],
  ["lembur", /\b(lembur(an|nya)?|overtime)\b/],
  ["hadir", /\b(hadir|kehadiran|absen|absensi|attendance|clock(ed)? in)\b/],
  ["hutang", /\b(hutang|utang|pemasok|supplier|payable)\b/],
  ["piutang_lewat", /\b(lewat (jatuh )?tempo|jatuh tempo|telat|terlambat|nunggak|menunggak|overdue|past due)\b/],
  ["piutang", /\b(piutang|ngutang|belum (di)?bayar|belum lunas|unpaid|receivable)\b/],
  ["kas", /\b(kas|saldo|uang (di bank|tunai|kas|di rekening)|rekening|sisa uang|cash|balance)\b/],
  ["stok", /\b(stok|stock|persediaan|sisa|inventory)\b/],
  ["laba", /\b(laba|untung|keuntungan|rugi|kerugian|profit|loss)\b/],
  ["beban", /\b(pengeluaran|beban|biaya|belanja|uang keluar|expense|expenses|spending|spent)\b/],
  ["pendapatan", /\b(penjualan|jualan|omzet|omset|pendapatan|pemasukan|revenue|sales|income)\b/],
  ["invoice_terbit", /\b(invoice|faktur|nota tagihan|tagihan terbit)\b/],
  ["karyawan", /\b(karyawan|pegawai|staf|staff|employees?|pekerja)\b/],
];
const DITOLAK = /\b(terbaik|terburuk|paling|kenapa|mengapa|bagaimana|gimana|sebaiknya|saran|prediksi|ramal|ramalan|why|how to|best|worst|should)\b/;
const TITIK: Niat[] = ["kas", "piutang", "piutang_lewat", "hutang", "karyawan", "stok"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const tgl = (s: string) => new Date(`${s}T00:00:00Z`);
const geser = (s: string, hari: number) => iso(new Date(tgl(s).getTime() + hari * 86400000));
const akhirBulan = (th: number, bl: number) => iso(new Date(Date.UTC(th, bl, 0)));

/** Rentang dari kata waktu di kalimat; null bila tidak ada. hariIni dalam YYYY-MM-DD zona usaha. */
export function rentang(t: string, hariIni: string): { dari: string; sampai: string } | null {
  const [th, bl] = hariIni.split("-").map(Number);
  const senin = geser(hariIni, -((tgl(hariIni).getUTCDay() + 6) % 7));
  const n = /\b(\d{1,3}) (hari|days?) (terakhir|last)\b|\blast (\d{1,3}) days?\b/.exec(t);
  if (n) {
    const k = Math.min(366, Math.max(1, Number(n[1] ?? n[4])));
    return { dari: geser(hariIni, -(k - 1)), sampai: hariIni };
  }
  if (/\b(hari ini|today|sekarang|saat ini|now)\b/.test(t) && !/\b(bulan|minggu|tahun|month|week|year)\b/.test(t)) return { dari: hariIni, sampai: hariIni };
  if (/\b(kemarin|yesterday)\b/.test(t)) { const k = geser(hariIni, -1); return { dari: k, sampai: k }; }
  if (/\b(minggu ini|pekan ini|this week)\b/.test(t)) return { dari: senin, sampai: hariIni };
  if (/\b(minggu lalu|pekan lalu|last week)\b/.test(t)) return { dari: geser(senin, -7), sampai: geser(senin, -1) };
  if (/\b(bulan ini|this month)\b/.test(t)) return { dari: `${th}-${pad(bl)}-01`, sampai: hariIni };
  if (/\b(bulan lalu|bulan kemarin|last month)\b/.test(t)) {
    const [y, m] = bl === 1 ? [th - 1, 12] : [th, bl - 1];
    return { dari: `${y}-${pad(m)}-01`, sampai: akhirBulan(y, m) };
  }
  if (/\b(tahun ini|this year)\b/.test(t)) return { dari: `${th}-01-01`, sampai: hariIni };
  if (/\b(tahun lalu|last year)\b/.test(t)) return { dari: `${th - 1}-01-01`, sampai: `${th - 1}-12-31` };
  // M-22B: rentang bebas "tanggal 3 sampai 10 november", "3-10 nov 2026", "28 oktober sampai 4 november".
  const bln = Object.keys(BULAN).join("|");
  const rr = new RegExp(`\\b(?:tanggal |tgl |dari )?(\\d{1,2})(?: (${bln}))? ?(?:sampai|hingga|s/d|sd|-|to|until) ?(?:tanggal |tgl )?(\\d{1,2}) (${bln})\\b(?: (\\d{4}))?`).exec(t);
  if (rr) {
    const m2 = BULAN[rr[4]];
    const m1 = rr[2] ? BULAN[rr[2]] : m2;
    const y2 = rr[5] ? Number(rr[5]) : m2 > bl ? th - 1 : th;
    const y1 = m1 > m2 ? y2 - 1 : y2;
    const d1 = Number(rr[1]);
    const d2 = Number(rr[3]);
    const dari = `${y1}-${pad(m1)}-${pad(d1)}`;
    const sampai = `${y2}-${pad(m2)}-${pad(d2)}`;
    if (d1 >= 1 && d2 >= 1 && dari <= akhirBulan(y1, m1) && sampai <= akhirBulan(y2, m2) && dari <= sampai) return { dari, sampai };
  }
  const b = new RegExp(`\\b(${bln})\\b(?: (\\d{4}))?`).exec(t);
  if (b) {
    const m = BULAN[b[1]];
    const y = b[2] ? Number(b[2]) : m > bl ? th - 1 : th;
    const sampai = y === th && m === bl ? hariIni : akhirBulan(y, m);
    return { dari: `${y}-${pad(m)}-01`, sampai };
  }
  return null;
}

const KATA_STOK = /\b(stok|stock|persediaan|sisa|inventory|berapa|masih|ada|yang|barang|kita|sekarang|jumlah|tinggal|of|how|many|much|left|is|are|the|di|gudang|toko|saat|ini)\b/g;

/** Kalimat huruf kecil tanpa tanda baca, diapit spasi (supaya kata dicocokkan utuh). */
export const normal = (kalimat: string) => ` ${kalimat.toLowerCase().replace(/[?!.,;:"'()]/g, " ").replace(/\s+/g, " ").trim()} `;
/** Pertanyaan pendapat, sebab, atau ramalan: tidak dijawab dengan angka dan tidak dipelajari. */
export const ditolak = (kalimat: string) => DITOLAK.test(normal(kalimat));
/** Niat bawaan (tanpa aturan belajar); null bila tidak ada kata yang dikenali. */
export const niatBawaan = (kalimat: string): Niat | null => NIAT.find(([, re]) => re.test(normal(kalimat)))?.[0] ?? null;
/** Aturan yang katanya muncul utuh di kalimat (yang terpanjang lebih dulu). */
export const aturanCocok = (kalimat: string, aturan: readonly AturanTanya[]) =>
  [...aturan].sort((a, b) => b.kata.length - a.kata.length).find((a) => normal(kalimat).includes(` ${a.kata} `)) ?? null;

/** Kalimat menjadi niat + rentang; null bila tidak bisa dijawab dengan angka. Aturan belajar dipakai bila niat bawaan tidak ada. */
export function uraiTanya(kalimat: string, hariIni: string, aturan: readonly AturanTanya[] = []): Tanya | null {
  const t = normal(kalimat);
  if (DITOLAK.test(t)) return null;
  const bawaan = niatBawaan(kalimat);
  const dari = bawaan ? null : aturanCocok(kalimat, aturan);
  const niat = bawaan ?? dari?.niat;
  if (!niat) return null;
  const hasil = bentukTanya(kalimat, hariIni, niat);
  return hasil && dari ? { ...hasil, aturan: dari.id ?? dari.kata } : hasil;
}

/** Niat yang sudah diketahui (dari pengurai, aturan, atau model) menjadi pertanyaan lengkap dengan rentang tanggal. */
export function bentukTanya(kalimat: string, hariIni: string, niat: Niat): Tanya | null {
  const t = normal(kalimat);
  if (TITIK.includes(niat)) {
    const hasil: Tanya = { niat, dari: hariIni, sampai: hariIni };
    if (niat === "stok") {
      const cari = t.replace(KATA_STOK, " ").replace(/\s+/g, " ").trim();
      if (cari.length < 2) return null;
      hasil.cari = cari;
    }
    return hasil;
  }
  const r = rentang(t, hariIni);
  if (r) return { niat, ...r };
  // Bawaan: kehadiran hari ini, gaji bulan lalu (gaji bulan berjalan biasanya belum disetujui), lainnya bulan berjalan.
  if (niat === "hadir") return { niat, dari: hariIni, sampai: hariIni };
  const [th, bl] = hariIni.split("-").map(Number);
  if (niat === "gaji") {
    const [y, m] = bl === 1 ? [th - 1, 12] : [th, bl - 1];
    return { niat, dari: `${y}-${pad(m)}-01`, sampai: akhirBulan(y, m) };
  }
  return { niat, dari: `${th}-${pad(bl)}-01`, sampai: hariIni };
}

const PENGHUBUNG = /\b(dan|serta|sama|and|plus)\b|&/;

/**
 * M-22B: pertanyaan gabungan ("penjualan dan laba bulan ini") menjadi beberapa pertanyaan dengan periode yang sama, urut sesuai
 * kalimat, paling banyak 3. Tanpa penghubung, atau hanya satu ukuran, sama dengan uraiTanya. Ukuran umum yang tertutup ukuran lebih
 * khusus dibuang (piutang bila ada lewat jatuh tempo, karyawan bila ada gaji/lembur/hadir).
 */
export function uraiTanyaBanyak(kalimat: string, hariIni: string, aturan: readonly AturanTanya[] = []): Tanya[] {
  const t = normal(kalimat);
  if (DITOLAK.test(t)) return [];
  if (PENGHUBUNG.test(t)) {
    const cocok = NIAT.map(([n, re]) => {
      const m = re.exec(t);
      return m ? { n, i: m.index } : null;
    }).filter((c): c is { n: Niat; i: number } => c !== null);
    const ada = new Set(cocok.map((c) => c.n));
    const buang = new Set<Niat>();
    if (ada.has("piutang_lewat")) buang.add("piutang");
    if (ada.has("gaji") || ada.has("lembur") || ada.has("hadir")) buang.add("karyawan");
    if (ada.has("kas")) buang.add("stok");
    const pilih = cocok.filter((c) => !buang.has(c.n)).sort((x, y) => x.i - y.i).slice(0, 3);
    if (pilih.length >= 2) {
      const hasil = pilih.map((c) => bentukTanya(kalimat, hariIni, c.n)).filter((x): x is Tanya => x !== null);
      if (hasil.length >= 2) return hasil;
    }
  }
  const satu = uraiTanya(kalimat, hariIni, aturan);
  return satu ? [satu] : [];
}
