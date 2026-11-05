// M-22 pengurai pertanyaan: kalimat sehari-hari (Indonesia, sebagian Inggris) menjadi satu niat dari daftar tetap RPC ask_data
// plus rentang tanggal, tanpa model dan tanpa SQL bebas. Pertanyaan yang meminta pendapat, sebab, atau ramalan ditolak (null)
// supaya Nadi tidak menjawab dengan angka yang tidak menjawab pertanyaannya.

export type Niat = "pendapatan" | "beban" | "laba" | "kas" | "piutang" | "piutang_lewat" | "hutang" | "invoice_terbit" | "karyawan" | "hadir" | "lembur" | "gaji" | "stok";
export type Tanya = { niat: Niat; dari: string; sampai: string; cari?: string };

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
  const b = new RegExp(`\\b(${Object.keys(BULAN).join("|")})\\b(?: (\\d{4}))?`).exec(t);
  if (b) {
    const m = BULAN[b[1]];
    const y = b[2] ? Number(b[2]) : m > bl ? th - 1 : th;
    const sampai = y === th && m === bl ? hariIni : akhirBulan(y, m);
    return { dari: `${y}-${pad(m)}-01`, sampai };
  }
  return null;
}

const KATA_STOK = /\b(stok|stock|persediaan|sisa|inventory|berapa|masih|ada|yang|barang|kita|sekarang|jumlah|tinggal|of|how|many|much|left|is|are|the|di|gudang|toko|saat|ini)\b/g;

/** Kalimat menjadi niat + rentang; null bila tidak bisa dijawab dengan angka. */
export function uraiTanya(kalimat: string, hariIni: string): Tanya | null {
  const t = ` ${kalimat.toLowerCase().replace(/[?!.,;:"'()]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (DITOLAK.test(t)) return null;
  const ketemu = NIAT.find(([, re]) => re.test(t));
  if (!ketemu) return null;
  const niat = ketemu[0];
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
