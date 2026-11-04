// M-06: jadwal penyusutan fiskal menurut Pasal 11 UU PPh sebagaimana diubah UU 7/2021 (HPP), dibaca 5 Nov 2026 dari
// peraturan.bpk.go.id/Download/178620. Ayat (1) garis lurus selama masa manfaat; ayat (2) saldo menurun (bukan bangunan): tarif x
// nilai sisa buku, sisa disusutkan sekaligus di akhir masa; ayat (3) mulai bulan pengeluaran; ayat (6) kelompok dan tarif.
// Database (app.susut_bulan) memakai rumus yang sama dan menjadi penghitung yang dipercaya; modul ini untuk pratinjau dan tes.

export type Kelompok = "k1" | "k2" | "k3" | "k4" | "bangunan_permanen" | "bangunan_tidak_permanen" | "tanah";
export type Metode = "garis_lurus" | "saldo_menurun";

/** Masa manfaat (tahun) dan tarif saldo menurun per tahun (Pasal 11 ayat (6)). Tanah tidak disusutkan (ayat (1)). */
export const KELOMPOK: Record<Kelompok, { tahun: number; tarifMenurun: number | null }> = {
  k1: { tahun: 4, tarifMenurun: 0.5 },
  k2: { tahun: 8, tarifMenurun: 0.25 },
  k3: { tahun: 16, tarifMenurun: 0.125 },
  k4: { tahun: 20, tarifMenurun: 0.1 },
  bangunan_permanen: { tahun: 20, tarifMenurun: null },
  bangunan_tidak_permanen: { tahun: 10, tarifMenurun: null },
  tanah: { tahun: 0, tarifMenurun: null },
};

/** Jadwal bulanan dari bulan perolehan sampai akhir masa manfaat; jumlahnya selalu sama persis dengan harga perolehan. */
export function jadwalSusut(harga: number, kelompok: Kelompok, metode: Metode, mulai: string): { bulan: string; nilai: number }[] {
  const k = KELOMPOK[kelompok];
  const n = k.tahun * 12;
  if (n === 0 || harga <= 0) return [];
  if (metode === "saldo_menurun" && !k.tarifMenurun) throw new Error("Bangunan dan tanah tidak boleh saldo menurun (Pasal 11 ayat (2))");
  const [th, bl] = mulai.split("-").map(Number);
  const hasil: { bulan: string; nilai: number }[] = [];
  let sisa = harga;
  let awalTahun = harga;
  for (let i = 0; i < n; i++) {
    const m = bl - 1 + i;
    const tahun = th + Math.floor(m / 12);
    const bulan = (m % 12) + 1;
    if (metode === "saldo_menurun" && bulan === 1 && i > 0) awalTahun = sisa;
    let nilai = metode === "garis_lurus" ? Math.round((harga * (i + 1)) / n) - Math.round((harga * i) / n) : Math.round((awalTahun * k.tarifMenurun!) / 12);
    if (i === n - 1) nilai = sisa;
    nilai = Math.min(nilai, sisa);
    sisa -= nilai;
    hasil.push({ bulan: `${tahun}-${String(bulan).padStart(2, "0")}`, nilai });
  }
  return hasil;
}

/** Nilai buku setelah penyusutan sampai dan termasuk bulan `sampai` (YYYY-MM). */
export function nilaiBuku(harga: number, kelompok: Kelompok, metode: Metode, mulai: string, sampai: string): number {
  return harga - jadwalSusut(harga, kelompok, metode, mulai).filter((x) => x.bulan <= sampai).reduce((s, x) => s + x.nilai, 0);
}
