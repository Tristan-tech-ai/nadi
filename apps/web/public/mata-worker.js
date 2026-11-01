// Worker Mata (F5-01). Model deteksi objek berjalan di perangkat lewat transformers.js 4.3.1 dari jsDelivr (pola sama dengan
// transkrip-worker.js); gambar tidak pernah dikirim ke mana pun. ID dan varian model datang dari konfigurasi database (model_mata).
// Pesan masuk: { id, model: { id, dtype, ambang }, gambar: { data: Uint8ClampedArray RGBA, lebar, tinggi } }.
// Pesan keluar: { id, jenis: "unduh", persen } | { id, jenis: "hasil", orang: [{ label, score, box }], ms } | { id, jenis: "galat", pesan }.
const SUMBER = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
let siap = null;
let kunci = "";
let RawImage = null;

async function muat(model, lapor) {
  const k = `${model.id}|${model.dtype}`;
  if (!siap || kunci !== k) {
    kunci = k;
    siap = import(SUMBER).then((m) => {
      RawImage = m.RawImage;
      return m.pipeline("object-detection", model.id, {
        dtype: model.dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && typeof p.progress === "number") lapor(p.progress);
        },
      });
    });
    siap.catch(() => {
      siap = null;
    });
  }
  return siap;
}

self.onmessage = async (e) => {
  const { id, model, gambar } = e.data;
  try {
    const deteksi = await muat(model, (persen) => self.postMessage({ id, jenis: "unduh", persen }));
    const t0 = performance.now();
    const img = new RawImage(gambar.data, gambar.lebar, gambar.tinggi, 4);
    const keluar = await deteksi(img, { threshold: model.ambang ?? 0.5, percentage: true });
    const orang = keluar.filter((d) => d.label === "person").map((d) => ({ label: d.label, score: d.score, box: d.box }));
    self.postMessage({ id, jenis: "hasil", orang, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    self.postMessage({ id, jenis: "galat", pesan: String((err && err.message) || err) });
  }
};
