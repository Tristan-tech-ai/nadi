// M-26 paket siap pembiayaan: rentang 12 bulan penuh (bulan berjalan sampai hari ini) dan ringkasan riwayat invoice per bulan.
// Angka keuangan diambil dari RPC laporan_keuangan dan umur_piutang yang sama dengan /app/buku (M-01); berkas ini hanya
// menyusun rentang dan menghitung riwayat invoice yang tidak punya RPC sendiri.

export type BulanRentang = { bulan: string; dari: string; sampai: string };

const pad = (n: number) => String(n).padStart(2, "0");
const akhirBulan = (th: number, bl: number) => new Date(Date.UTC(th, bl, 0)).getUTCDate();

/** 12 bulan terakhir, dari tanggal 1 sebelas bulan lalu sampai hariIni (YYYY-MM-DD); bulan berjalan berakhir di hariIni. */
export function rentang12Bulan(hariIni: string): { dari: string; sampai: string; bulan: BulanRentang[] } {
  const [th, bl] = hariIni.split("-").map(Number);
  const bulan: BulanRentang[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = (bl - 1 - i + 120) % 12;
    const y = th + Math.floor((bl - 1 - i) / 12);
    const kode = `${y}-${pad(m + 1)}`;
    bulan.push({ bulan: kode, dari: `${kode}-01`, sampai: i === 0 ? hariIni : `${kode}-${pad(akhirBulan(y, m + 1))}` });
  }
  return { dari: bulan[0].dari, sampai: hariIni, bulan };
}

export type InvoiceRingkas = { tanggal: string; total: number; status: string; lunas_tanggal: string | null };
export type RiwayatBulan = { bulan: string; terbit: number; nilai: number; lunas: number; nilaiLunas: number };

const hari = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Invoice per bulan terbit (yang batal tidak dihitung) dan rata-rata hari sampai lunas untuk invoice yang sudah lunas. */
export function riwayatInvoice(invoice: InvoiceRingkas[], bulan: BulanRentang[]): { baris: RiwayatBulan[]; rataHariBayar: number | null; tepat: number } {
  const per = new Map(bulan.map((b) => [b.bulan, { bulan: b.bulan, terbit: 0, nilai: 0, lunas: 0, nilaiLunas: 0 }]));
  const jarak: number[] = [];
  for (const v of invoice) {
    if (v.status === "batal") continue;
    const r = per.get(v.tanggal.slice(0, 7));
    if (!r) continue;
    r.terbit += 1;
    r.nilai += Number(v.total);
    if (v.lunas_tanggal) {
      r.lunas += 1;
      r.nilaiLunas += Number(v.total);
      jarak.push(Math.max(0, hari(v.tanggal, v.lunas_tanggal)));
    }
  }
  const rata = jarak.length ? Math.round((jarak.reduce((s, x) => s + x, 0) / jarak.length) * 10) / 10 : null;
  return { baris: [...per.values()], rataHariBayar: rata, tepat: jarak.length };
}
