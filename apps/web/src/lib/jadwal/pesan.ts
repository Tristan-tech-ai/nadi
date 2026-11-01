// Angka jam di pesan jadwal mengikuti EYD: desimal koma (4,5 jam), bukan titik. Jam dinding (07.00) tidak disentuh.

/** Menit ke jam dengan satu desimal koma: 150 -> "2,5", 180 -> "3". */
export function jamDesimal(menit: number): string {
  return (Math.round(menit / 6) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

/** Pesan batas lembur dari database ("jadi 4.5 jam") ditulis ulang dengan koma. */
export function rapikanPesanBatas(pesan: string): string {
  return pesan.replace(/(\d+)\.(\d+) jam/g, "$1,$2 jam");
}

/** Peringatan saat mengambil tawaran shift (ambil_tawaran tanpa konfirmasi), dalam kalimat untuk staf. */
export function teksPeringatanTukar(kode: readonly string[], lemburMenit: number): string[] {
  return kode.map((k) =>
    k === "lembur" ? `Kamu jadi lembur ${jamDesimal(lemburMenit)} jam hari itu. Lembur hanya bila kamu setuju.`
    : k === "lewat_40_minggu" ? "Jam kerjamu minggu itu jadi lebih dari 40 jam."
    : k === "kurang_libur" ? "Hari liburmu minggu itu jadi kurang."
    : k);
}
