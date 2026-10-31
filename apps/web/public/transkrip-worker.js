// Worker transkrip wawancara (F2-03). Model ucapan berjalan di perangkat penilai lewat transformers.js 4.3.1 dari jsDelivr
// (cara resmi di README pustaka); audio tidak dikirim ke pihak ketiga. ID model datang dari konfigurasi database.
// Pesan masuk: { id, model: { id, dtype, bahasa }, audio: Float32Array 16 kHz mono }.
// Pesan keluar: { id, jenis: "unduh", persen } | { id, jenis: "hasil", teks } | { id, jenis: "galat", pesan }.
const SUMBER = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
let siap = null;
let kunci = "";

async function muat(model, lapor) {
  const k = `${model.id}|${model.dtype}`;
  if (!siap || kunci !== k) {
    kunci = k;
    siap = import(SUMBER).then(({ pipeline }) =>
      pipeline("automatic-speech-recognition", model.id, {
        dtype: model.dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && typeof p.progress === "number") lapor(p.progress);
        },
      }),
    );
    siap.catch(() => {
      siap = null;
    });
  }
  return siap;
}

self.onmessage = async (e) => {
  const { id, model, audio } = e.data;
  try {
    const transkrip = await muat(model, (persen) => self.postMessage({ id, jenis: "unduh", persen }));
    const keluar = await transkrip(audio, { language: model.bahasa, task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ id, jenis: "hasil", teks: Array.isArray(keluar) ? keluar.map((x) => x.text).join(" ") : keluar.text });
  } catch (err) {
    self.postMessage({ id, jenis: "galat", pesan: String((err && err.message) || err) });
  }
};
