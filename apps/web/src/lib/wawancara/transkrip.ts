// Transkrip jawaban wawancara di perangkat penilai (F2-03). Audio diurai di utas utama (AudioContext tidak ada di worker),
// lalu sinyal 16 kHz mono dikirim ke public/transkrip-worker.js. Bagian murni (jadiMono, rapikanTranskrip) diuji vitest.

export type ModelTranskrip = { id: string; dtype: string; bahasa: string };
export const BATAS_TRANSKRIP = 4000;

/** Gabung kanal jadi mono seperti ffmpeg -ac 1 (rata-rata; dua kanal diskalakan 1/sqrt(2) agar tidak terpotong). */
export function jadiMono(kanal: Float32Array[]): Float32Array {
  if (kanal.length === 0) return new Float32Array(0);
  if (kanal.length === 1) return kanal[0];
  const skala = kanal.length === 2 ? Math.SQRT1_2 : 1 / kanal.length;
  const hasil = new Float32Array(kanal[0].length);
  for (const k of kanal) for (let i = 0; i < hasil.length; i++) hasil[i] += k[i] * skala;
  return hasil;
}

/** Spasi dirapikan, penanda bukan ucapan dari model ([Musik], (tertawa)) dibuang, panjang dibatasi sesuai database. */
export function rapikanTranskrip(teks: string): string {
  const bersih = teks.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return bersih.length > BATAS_TRANSKRIP ? bersih.slice(0, BATAS_TRANSKRIP) : bersih;
}

export async function uraiAudio(url: string): Promise<Float32Array> {
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const a = await ctx.decodeAudioData(data);
    return jadiMono(Array.from({ length: a.numberOfChannels }, (_, i) => a.getChannelData(i)));
  } finally {
    void ctx.close();
  }
}

let pekerja: Worker | null = null;
let nomor = 0;

/** Transkrip satu klip. onUnduh menerima persen unduhan model (hanya pada pemakaian pertama di perangkat ini). */
export async function transkripsi(url: string, model: ModelTranskrip, onUnduh?: (persen: number) => void): Promise<string> {
  const audio = await uraiAudio(url);
  pekerja ??= new Worker("/transkrip-worker.js", { type: "module" });
  const id = ++nomor;
  const w = pekerja;
  return new Promise((selesai, gagal) => {
    const dengar = (e: MessageEvent) => {
      const d = e.data as { id: number; jenis: string; persen?: number; teks?: string; pesan?: string };
      if (d.id !== id) return;
      if (d.jenis === "unduh") return onUnduh?.(d.persen ?? 0);
      w.removeEventListener("message", dengar);
      if (d.jenis === "hasil") selesai(rapikanTranskrip(d.teks ?? ""));
      else gagal(new Error(d.pesan ?? "transkrip gagal"));
    };
    w.addEventListener("message", dengar);
    w.postMessage({ id, model, audio }, [audio.buffer]);
  });
}
