// OCR foto di perangkat (tesseract.js, bahasa Indonesia). Dimuat dinamis hanya saat melempar foto,
// supaya ±2,5 MB pustaka dan data bahasa tidak ikut muatan awal aplikasi.

/** Hanya foto yang di-OCR; PDF berlapis teks, CSV, dan Excel sudah berupa teks. */
export const perluOcr = (mime: string) => mime.startsWith("image/");

/** Ambang keyakinan agar teks OCR boleh dipakai aturan tersimpan (lihat docs/research/ml-browser.md). */
export const AMBANG_OCR = 85;

export async function bacaTeksFoto(gambar: Blob): Promise<{ teks: string; keyakinan: number } | null> {
  try {
    const { createWorker } = await import("tesseract.js");
    const pekerja = await createWorker("ind");
    try {
      const { data } = await pekerja.recognize(gambar);
      return { teks: data.text, keyakinan: data.confidence };
    } finally {
      await pekerja.terminate();
    }
  } catch {
    return null; // OCR gagal (mis. tanpa sinyal untuk mengunduh data bahasa): foto tetap dibaca model.
  }
}
