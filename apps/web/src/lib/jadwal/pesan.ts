// Angka jam di pesan jadwal mengikuti EYD: desimal koma (4,5 jam), bukan titik. Jam dinding (07.00) tidak disentuh.

/** Menit ke jam dengan satu desimal koma: 150 -> "2,5", 180 -> "3". */
export function jamDesimal(menit: number, bahasa: "id" | "en" = "id"): string {
  return (Math.round(menit / 6) / 10).toLocaleString(bahasa === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 });
}

/** Pesan batas lembur dari database ("jadi 4.5 jam") ditulis ulang dengan koma. */
export function rapikanPesanBatas(pesan: string): string {
  return pesan.replace(/(\d+)\.(\d+) jam/g, "$1,$2 jam");
}

/** Peringatan saat mengambil tawaran shift (ambil_tawaran tanpa konfirmasi), dalam kalimat untuk staf. */
export type TeksTukar = { tukarLembur: string; tukar40: string; tukarLibur: string };
const TUKAR_ID: TeksTukar = {
  tukarLembur: "Kamu jadi lembur {jam} jam hari itu. Lembur hanya bila kamu setuju.",
  tukar40: "Jam kerjamu minggu itu jadi lebih dari 40 jam.",
  tukarLibur: "Hari liburmu minggu itu jadi kurang.",
};

export function teksPeringatanTukar(kode: readonly string[], lemburMenit: number, t: TeksTukar = TUKAR_ID, bahasa: "id" | "en" = "id"): string[] {
  return kode.map((k) =>
    k === "lembur" ? t.tukarLembur.replace("{jam}", jamDesimal(lemburMenit, bahasa))
    : k === "lewat_40_minggu" ? t.tukar40
    : k === "kurang_libur" ? t.tukarLibur
    : k);
}
