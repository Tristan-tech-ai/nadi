// Alat bantu rekaman jawaban wawancara (F2-03) yang tidak bergantung pada browser, supaya bisa diuji.
// Urutan kandidat mengikuti saran MDN MediaRecorder.isTypeSupported (docs/research/wawancara.md, loop/LEARN.md).

export const KANDIDAT_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"] as const;
export const DURASI_MAKS_DETIK = 90;

/** Format rekaman pertama yang didukung peramban; null bila tidak ada (tampilkan pesan, jangan merekam). */
export function pilihMime(didukung: (mime: string) => boolean): string | null {
  return KANDIDAT_MIME.find((m) => didukung(m)) ?? null;
}

/** Tipe dasar untuk unggahan dan RPC (tanpa parameter codecs), sesuai daftar yang diizinkan bucket. */
export const mimeDasar = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** Detik ke tampilan "0:42" untuk penghitung rekaman. */
export function formatDurasi(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
}
