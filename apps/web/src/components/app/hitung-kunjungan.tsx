"use client";

import { useEffect, useRef, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { aturPapan, kirimRekap } from "@/app/app/mata/actions";
import { abuDari, deteksi, formatDurasi, LatarHidup, latarMedianStabil, OPSI_DETEKSI, OPSI_DETEKSI_PEKA, OPSI_PELACAK, OPSI_PELACAK_MIRING, Pelacak, rekapJam, stabilkan, titikDariKotak, type Bingkai, type Kunjungan, type ZonaV2 } from "@/lib/mata/jejak";
import { gambarMata } from "@/lib/mata/gambar";
import { alamatKamera, ALAMAT_JEMBATAN, bukaJembatan, jembatanSah, konfigJembatan, MEREK, type Merek } from "@/lib/mata/jembatan";
import type { Deteksi } from "@/lib/mata/resep";
import type { ModelMata } from "@/components/app/layar-mata";

// W-02 Mata v2: kamera atas atau rekaman diproses di perangkat ini (beda latar + pelacak posisi, src/lib/mata/jejak.ts).
// Bingkai diperkecil ke 160 px, dibaca, lalu dibuang. Yang dikirim hanya rekap per jam (jumlah dan detik).
const LEBAR = 160;
const FPS = 5;
// Kamera miring memakai model deteksi orang (sekitar 0,1 sampai 0,3 detik per bingkai di perangkat), jadi 2 bingkai per detik.
const FPS_MIRING = 2;
const LEBAR_MODEL = 640;
const KIRIM_TIAP_MS = 5 * 60 * 1000;
// V-12 layar pelacakan: video asli di perangkat, digambar ulang 640 px dengan zona, garis lintasan, dan nomor anonim.
const LEBAR_LAYAR = 640;

type Ringkas = { n: number; lama: number; tungguN: number; tunggu: number; layanN: number; layan: number };
function ringkas(k: Kunjungan[]): Ringkas {
  const r: Ringkas = { n: k.length, lama: 0, tungguN: 0, tunggu: 0, layanN: 0, layan: 0 };
  for (const x of k) {
    r.lama += x.lama;
    if (x.tunggu >= 1) {
      r.tungguN++;
      r.tunggu += x.tunggu;
    }
    if (x.layan >= 1) {
      r.layanN++;
      r.layan += x.layan;
    }
  }
  return r;
}

export function HitungKunjungan({ zona, papanAwal, model, teks: t, bahasa }: { zona: ZonaV2[]; papanAwal: boolean; model?: ModelMata; teks: Kamus["kunjungan"]; bahasa: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const pratinjau = useRef<HTMLCanvasElement>(null);
  const layar = useRef<HTMLCanvasElement>(null);
  const [pintu, setPintu] = useState({ masuk: 0, keluar: 0 });
  const berhenti = useRef(false);
  const [papan, setPapan] = useState(papanAwal);
  const [jalan, setJalan] = useState(false);
  const [kemajuan, setKemajuan] = useState<{ ke: number; dari: number } | null>(null);
  const [terlihat, setTerlihat] = useState(0);
  const [selesai, setSelesai] = useState<Kunjungan[]>([]);
  const [pesan, setPesan] = useState<{ jenis: "info" | "galat"; teks: string } | null>(null);
  const [terkirim, setTerkirim] = useState(false);
  const [kamera, setKamera] = useState<"atas" | "miring">("atas");
  // V-12: kepekaan tinggi untuk kamera sungguhan berkontras rendah (diukur pada footage CCTV asli, src/lib/mata/jejak.ts).
  const [peka, setPeka] = useState<"normal" | "tinggi">("normal");
  const opsiDeteksi = peka === "tinggi" ? OPSI_DETEKSI_PEKA : OPSI_DETEKSI;
  const pekerja = useRef<Worker | null>(null);
  const adaPintu = zona.some((z) => z.jenis === "pintu");
  // W-10A jembatan CCTV: isian hanya di memori halaman ini; kata sandi masuk ke berkas unduhan saja.
  const [merek, setMerek] = useState<Merek>("hikvision");
  const [kam, setKam] = useState({ alamat: "", pengguna: "", sandi: "", kanal: "1", kecil: true });
  const [galatKam, setGalatKam] = useState<string | null>(null);
  const [alamatJembatan, setAlamatJembatan] = useState(ALAMAT_JEMBATAN);

  useEffect(() => () => {
    berhenti.current = true;
    pekerja.current?.terminate();
    (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((x) => x.stop());
  }, []);

  /** Kamera miring: kotak orang dari model Mata di Web Worker, lalu titik kaki. Gambar tidak keluar dari perangkat. */
  function titikModel(v: HTMLVideoElement): Promise<{ x: number; y: number }[]> {
    const m = model!;
    const s = Math.min(1, LEBAR_MODEL / v.videoWidth);
    const k = document.createElement("canvas");
    k.width = Math.round(v.videoWidth * s);
    k.height = Math.round(v.videoHeight * s);
    const g = k.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(v, 0, 0, k.width, k.height);
    const data = g.getImageData(0, 0, k.width, k.height).data;
    pekerja.current ??= new Worker("/mata-worker.js", { type: "module" });
    const w = pekerja.current;
    const id = Math.random().toString(36).slice(2);
    return new Promise((selesai, gagal) => {
      const dengar = (e: MessageEvent) => {
        if (e.data.id !== id || e.data.jenis === "unduh") return;
        w.removeEventListener("message", dengar);
        if (e.data.jenis === "hasil") selesai(titikDariKotak(e.data.orang as Deteksi[], m.ambang));
        else gagal(new Error(e.data.pesan));
      };
      w.addEventListener("message", dengar);
      w.postMessage({ id, model: { id: m.id, dtype: m.dtype, ambang: m.ambang }, gambar: { data, lebar: k.width, tinggi: k.height } }, [data.buffer]);
    });
  }

  async function ubahPapan(pasang: boolean) {
    setPapan(pasang);
    setPesan(null);
    const h = await aturPapan(pasang);
    if ("galat" in h) {
      setPapan(!pasang);
      setPesan({ jenis: "galat", teks: h.galat });
    }
  }

  function bingkai(v: HTMLVideoElement, kanvas: HTMLCanvasElement) {
    const tinggi = Math.max(1, Math.round((LEBAR * v.videoHeight) / v.videoWidth));
    kanvas.width = LEBAR;
    kanvas.height = tinggi;
    const g = kanvas.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(v, 0, 0, LEBAR, tinggi);
    return abuDari(g.getImageData(0, 0, LEBAR, tinggi).data, LEBAR, tinggi);
  }

  /** Gambar bingkai video lalu lapisan pelacakan (src/lib/mata/gambar.ts): zona berlabel jumlah orang, jejak memudar, nomor anonim,
   *  hitungan pintu. Hanya di layar ini; tidak ada yang disimpan atau dikirim. */
  function gambarLayar(v: HTMLVideoElement, p: Pelacak) {
    const c = layar.current;
    if (!c || !v.videoWidth) return;
    const tinggi = Math.round((LEBAR_LAYAR * v.videoHeight) / v.videoWidth);
    if (c.width !== LEBAR_LAYAR || c.height !== tinggi) { c.width = LEBAR_LAYAR; c.height = tinggi; }
    const g = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const warna = (v: string, cadangan: string) => css.getPropertyValue(v).trim() || cadangan;
    g.drawImage(v, 0, 0, c.width, c.height);
    const h = p.pintu;
    gambarMata(g, c.width, c.height, {
      jejak: p.tampil, zona, pintu: h, teks: { hud: t.hud, masuk: t.pintuMasuk, keluar: t.pintuKeluar },
      // Lapisan di atas video: terang/gelap tetap (tidak ikut tema) supaya terbaca di atas gambar apa pun.
      warna: { aksen: warna("--kunyit", "orange"), terang: "white", gelap: "black", hidup: warna("--daun", "green") },
    });
    setPintu(h);
  }

  async function kirim(k: Kunjungan[], asalMs: number, kunci: string) {
    const r = rekapJam(k, asalMs);
    if (!r.length) return true;
    const h = await kirimRekap(r, kunci);
    if ("galat" in h) {
      setPesan({ jenis: "galat", teks: h.galat });
      return false;
    }
    setTerkirim(true);
    setPesan({ jenis: "info", teks: h.sudah ? t.sudahTerkirim : t.terkirim });
    return true;
  }

  async function dariBerkas(f: File | undefined) {
    const v = video.current;
    const c = pratinjau.current;
    if (!f || !v || !c) return;
    setPesan(null);
    setSelesai([]);
    setTerkirim(false);
    setPintu({ masuk: 0, keluar: 0 });
    berhenti.current = false;
    v.srcObject = null;
    v.src = URL.createObjectURL(f);
    try {
      await new Promise<void>((ok, gagal) => {
        v.addEventListener("loadeddata", () => ok(), { once: true });
        v.addEventListener("error", () => gagal(new Error("video")), { once: true });
      });
    } catch {
      return setPesan({ jenis: "galat", teks: t.gagalVideo });
    }
    setJalan(true);
    const miring = kamera === "miring" && Boolean(model);
    const fps = miring ? FPS_MIRING : FPS;
    const n = Math.floor(v.duration * fps);
    // Rekaman dianggap baru selesai: detik 0 = sekarang dikurangi panjang video.
    const asalMs = Date.now() - v.duration * 1000;
    const p = new Pelacak(zona, miring ? OPSI_PELACAK_MIRING : OPSI_PELACAK);
    const hasil: Kunjungan[] = [];
    const ke = (t: number) => new Promise<void>((ok) => {
      v.addEventListener("seeked", () => ok(), { once: true });
      v.currentTime = t;
    });
    // Latar = median 15 bingkai tersebar: rekaman jarang dimulai dari ruang kosong (W-02B).
    const contoh: Bingkai[] = [];
    for (let k = 0; k < 15; k++) {
      await ke(((k + 0.5) / 15) * v.duration);
      contoh.push(bingkai(v, c));
    }
    const latar = latarMedianStabil(contoh);
    for (let i = 0; i < n && !berhenti.current; i++) {
      await ke(i / fps);
      const b = bingkai(v, c);
      let titik: { x: number; y: number }[];
      try {
        titik = miring ? await titikModel(v) : deteksi(latar, stabilkan(latar, b), opsiDeteksi);
      } catch {
        setPesan({ jenis: "galat", teks: t.modelGagal });
        break;
      }
      hasil.push(...p.langkah(i / fps, titik));
      gambarLayar(v, p);
      if (i % 5 === 0) {
        setKemajuan({ ke: i + 1, dari: n });
        setTerlihat(p.terlihat.length);
        setSelesai([...hasil]);
      }
    }
    hasil.push(...p.selesai());
    setSelesai(hasil);
    setTerlihat(0);
    setKemajuan(null);
    setJalan(false);
    // Kunci per kali hitung: kirim ulang hasil yang sama (jaringan putus) tidak menggandakan angka.
    await kirim(hasil, asalMs, `berkas-${f.size}-${Math.round(asalMs)}`);
  }

  function unduhKonfig() {
    const h = alamatKamera({ merek, alamat: kam.alamat, pengguna: kam.pengguna, sandi: kam.sandi, kanal: Number(kam.kanal), kecil: kam.kecil });
    if (!h.ok) return setGalatKam(t.jembatanGalat[h.galat]);
    setGalatKam(null);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([konfigJembatan(h.url)], { type: "text/yaml" }));
    a.download = "go2rtc.yaml";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function dariKamera() {
    let aliran: MediaStream;
    try {
      aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      return setPesan({ jenis: "galat", teks: t.gagalVideo });
    }
    await hitungLangsung(aliran, () => aliran.getTracks().forEach((x) => x.stop()), "kamera");
  }

  /** W-10A: CCTV lewat jembatan go2rtc di komputer ini (WebRTC dari 127.0.0.1). Video tidak lewat server Nadi. */
  async function dariJembatan() {
    if (!jembatanSah(alamatJembatan)) return setPesan({ jenis: "galat", teks: t.jembatanAlamatSalah });
    setPesan(null);
    let h: Awaited<ReturnType<typeof bukaJembatan>>;
    try {
      h = await bukaJembatan(alamatJembatan);
    } catch {
      return setPesan({ jenis: "galat", teks: t.jembatanGagal });
    }
    await hitungLangsung(h.aliran, () => {
      h.aliran.getTracks().forEach((x) => x.stop());
      h.pc.close();
    }, "jembatan", h.pc);
  }

  async function hitungLangsung(aliran: MediaStream, tutup: () => void, asal: "kamera" | "jembatan", pc?: RTCPeerConnection) {
    const v = video.current;
    const c = pratinjau.current;
    if (!v || !c) return tutup();
    v.src = "";
    v.srcObject = aliran;
    await v.play();
    setPesan(null);
    setSelesai([]);
    setTerkirim(false);
    berhenti.current = false;
    setJalan(true);
    const asalMs = Date.now();
    const sesi = `${asal}-${asalMs}`;
    // Jembatan: kamera yang berhenti mengirim gambar (CCTV mati, rekaman habis) mengakhiri hitungan setelah 8 dtk.
    let bingkaiTerakhir = -1;
    let diamSejak = Date.now();
    let putus = false;
    aliran.getVideoTracks()[0]?.addEventListener("ended", () => { putus = true; berhenti.current = true; });
    const miring = kamera === "miring" && Boolean(model);
    const p = new Pelacak(zona, miring ? OPSI_PELACAK_MIRING : OPSI_PELACAK);
    const lh = new LatarHidup();
    const fps = miring ? FPS_MIRING : FPS;
    let berikut = Date.now();
    let tertunda: Kunjungan[] = [];
    const semua: Kunjungan[] = [];
    let kirimAkhir = Date.now();
    let ke = 0;
    while (!berhenti.current) {
      if (asal === "jembatan") {
        const nb = v.getVideoPlaybackQuality().totalVideoFrames;
        if (nb !== bingkaiTerakhir) {
          bingkaiTerakhir = nb;
          diamSejak = Date.now();
        } else if (Date.now() - diamSejak > 8000 || (pc && ["failed", "closed"].includes(pc.connectionState))) {
          putus = true;
          break;
        }
      }
      const b = bingkai(v, c);
      const t0 = (Date.now() - asalMs) / 1000;
      // Kamera atas: latar median bergulir (LatarHidup); bingkai pemanasan ditampung lalu dideteksi, jadi tidak ada yang terlewat.
      const siap = miring ? [{ t: t0, b }] : lh.tambah(t0, b);
      if (!miring && !lh.latar) setPesan({ jenis: "info", teks: isiTeks(t.latarHidup, { n: Math.ceil(lh.sisa(t0)) }) });
      else if (siap.length > 1) setPesan(null);
      for (const x of siap) {
        let titik: { x: number; y: number }[] = [];
        try {
          titik = miring ? await titikModel(v) : deteksi(lh.latar!, stabilkan(lh.latar!, x.b), opsiDeteksi);
        } catch {
          setPesan({ jenis: "galat", teks: t.modelGagal });
          berhenti.current = true;
        }
        const k = p.langkah(x.t, titik);
        tertunda.push(...k);
        semua.push(...k);
      }
      if (siap.length) {
        gambarLayar(v, p);
        setTerlihat(p.terlihat.length);
        setSelesai([...semua]);
      }
      if (Date.now() - kirimAkhir > KIRIM_TIAP_MS && tertunda.length) {
        if (await kirim(tertunda, asalMs, `${sesi}-${ke++}`)) tertunda = [];
        kirimAkhir = Date.now();
      }
      // Irama tetap (bukan jeda tetap): waktu proses tidak menurunkan bingkai per detik.
      berikut += 1000 / fps;
      if (berikut < Date.now() - 1000) berikut = Date.now();
      await new Promise((ok) => setTimeout(ok, Math.max(0, berikut - Date.now())));
    }
    if (!miring) for (const x of lh.paksa()) p.langkah(x.t, deteksi(lh.latar!, stabilkan(lh.latar!, x.b), opsiDeteksi));
    const akhir = p.selesai();
    tertunda.push(...akhir);
    semua.push(...akhir);
    setSelesai(semua);
    tutup();
    setJalan(false);
    if (await kirim(tertunda, asalMs, `${sesi}-${ke}`) && putus) setPesan((p) => ({ jenis: "info", teks: `${t.jembatanBerhenti} ${p?.teks ?? ""}`.trim() }));
  }

  const r = ringkas(selesai);
  const rata = (jumlah: number, n: number) => (n ? formatDurasi(jumlah / n, bahasa) : "-");
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-kunjungan" data-testid="hitung-kunjungan">
      <h2 id="judul-kunjungan" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>
      {!adaPintu ? (
        <p className="mt-3 text-sm" data-testid="kunjungan-perlu-pintu">{t.perluPintu}</p>
      ) : (
        <>
          <div className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4">
            <h3 className="font-semibold">{t.papanJudul}</h3>
            <p className="mt-1 text-sm text-tinta-2">{t.papanKet}</p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={papan} onChange={(e) => ubahPapan(e.target.checked)} data-testid="kunjungan-papan" />
              <span>{t.papanCentang}</span>
            </label>
            <a href="/cetak/papan-mata" target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold text-laut underline underline-offset-4">{t.papanCetak}</a>
          </div>
          {model ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">{t.kameraJudul}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["atas", "miring"] as const).map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-isian)] border border-garis px-3 text-sm has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
                    <input type="radio" name="kamera-mata" value={k} checked={kamera === k} onChange={() => setKamera(k)} disabled={jalan} className="accent-[var(--tinta)]" />
                    {k === "atas" ? t.kameraAtas : t.kameraMiring}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-tinta-2">{kamera === "atas" ? t.kameraAtasKet : t.kameraMiringKet}</p>
            </fieldset>
          ) : null}
          {kamera === "atas" ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">{t.pekaJudul}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["normal", "tinggi"] as const).map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-isian)] border border-garis px-3 text-sm has-[:checked]:border-tinta has-[:checked]:bg-kertas-2">
                    <input type="radio" name="peka-mata" value={k} checked={peka === k} onChange={() => setPeka(k)} disabled={jalan} className="accent-[var(--tinta)]" data-testid={`peka-${k}`} />
                    {k === "normal" ? t.pekaNormal : t.pekaTinggi}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {!papan ? (
            <p className="mt-3 text-sm text-tinta-2">{t.papanBelum}</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-input)] border border-garis-kuat px-4 text-sm font-semibold">
                {t.pilihVideo}
                <input type="file" accept="video/*" className="sr-only" disabled={jalan} onChange={(e) => dariBerkas(e.target.files?.[0])} data-testid="kunjungan-berkas" />
              </label>
              {jalan ? <Tombol type="button" onClick={() => (berhenti.current = true)}>{t.berhenti}</Tombol> : <Tombol type="button" ragam="kedua" onClick={dariKamera}>{t.pakaiKamera}</Tombol>}
            </div>
          )}
        </>
      )}
            <details id="cctv" className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="jembatan">
              <summary className="cursor-pointer font-semibold">{t.jembatanJudul}</summary>
              <p className="mt-2 max-w-2xl text-sm text-tinta-2">{t.jembatanKet}</p>
              <ol className="mt-3 max-w-2xl list-decimal space-y-4 pl-5 text-sm">
                <li>
                  {t.jembatanLangkah1}{" "}
                  <a href="https://github.com/AlexxIT/go2rtc/releases/latest" target="_blank" rel="noopener noreferrer" className="font-semibold text-laut underline underline-offset-4">{t.jembatanUnduhGo2rtc}</a>
                </li>
                <li>
                  {t.jembatanLangkah2}
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-tinta-2">{t.jembatanMerek}</span>
                      <select value={merek} onChange={(e) => setMerek(e.target.value as Merek)} className="min-h-11 rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3" data-testid="jembatan-merek">
                        {MEREK.map((m) => <option key={m} value={m}>{t.jembatanNamaMerek[m]}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-tinta-2">{merek === "lengkap" ? t.jembatanRtsp : t.jembatanIp}</span>
                      <input value={kam.alamat} onChange={(e) => setKam({ ...kam, alamat: e.target.value })} autoComplete="off" spellCheck={false} inputMode={merek === "lengkap" ? "url" : "decimal"} className="min-h-11 rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3" data-testid="jembatan-alamat-kamera" />
                    </label>
                    {merek !== "lengkap" && merek !== "ezviz" ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-tinta-2">{t.jembatanPengguna}</span>
                        <input value={kam.pengguna} onChange={(e) => setKam({ ...kam, pengguna: e.target.value })} autoComplete="off" className="min-h-11 rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3" />
                      </label>
                    ) : null}
                    {merek !== "lengkap" ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-tinta-2">{merek === "ezviz" ? t.jembatanSandiEzviz : t.jembatanSandi}</span>
                        <input type="password" value={kam.sandi} onChange={(e) => setKam({ ...kam, sandi: e.target.value })} autoComplete="new-password" className="min-h-11 rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3" />
                      </label>
                    ) : null}
                    {merek === "hikvision" || merek === "dahua" ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-tinta-2">{t.jembatanKanal}</span>
                        <input type="number" min={1} max={64} value={kam.kanal} onChange={(e) => setKam({ ...kam, kanal: e.target.value })} className="min-h-11 rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3" />
                      </label>
                    ) : null}
                    {merek === "hikvision" || merek === "dahua" || merek === "tapo" ? (
                      <label className="flex items-center gap-2 sm:col-span-2">
                        <input type="checkbox" className="size-4" checked={kam.kecil} onChange={(e) => setKam({ ...kam, kecil: e.target.checked })} />
                        <span>{t.jembatanKecil}</span>
                      </label>
                    ) : null}
                  </div>
                  {merek === "tapo" ? <p className="mt-2 text-tinta-2">{t.jembatanTapo}</p> : null}
                  {merek === "lengkap" ? <p className="mt-2 text-tinta-2 [overflow-wrap:anywhere]">{t.jembatanRtspKet}</p> : null}
                  <p className="mt-2 text-tinta-2">{t.jembatanSandiKet}</p>
                  {galatKam ? <p role="alert" className="mt-2 text-cap">{galatKam}</p> : null}
                  <Tombol type="button" ragam="kedua" className="mt-3" onClick={unduhKonfig} data-testid="jembatan-unduh">{t.jembatanUnduh}</Tombol>
                </li>
                <li>{t.jembatanLangkah3}</li>
                <li>
                  {t.jembatanLangkah4}
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-tinta-2">{t.jembatanAlamat}</span>
                      <input value={alamatJembatan} onChange={(e) => setAlamatJembatan(e.target.value)} spellCheck={false} className="min-h-11 w-64 max-w-full rounded-[var(--radius-input)] border border-garis-kuat bg-kertas px-3 font-mono" data-testid="jembatan-alamat" />
                    </label>
                    <Tombol type="button" ragam="kedua" onClick={dariJembatan} disabled={jalan || !adaPintu || !papan} data-testid="jembatan-mulai">{t.jembatanMulai}</Tombol>
                  </div>
                  {!adaPintu || !papan ? <p className="mt-2 text-tinta-2" data-testid="jembatan-syarat">{!adaPintu ? t.perluPintu : t.papanBelum}</p> : null}
                </li>
              </ol>
              <p className="mt-4 max-w-2xl text-sm text-tinta-2">{t.jembatanTidakAda}</p>
            </details>
      <video ref={video} className="hidden" muted playsInline />
      <canvas ref={pratinjau} className="hidden" aria-hidden />
      <figure className={`mt-4 ${jalan || selesai.length > 0 ? "" : "hidden"}`}>
        <canvas ref={layar} className="w-full max-w-2xl rounded-[var(--radius-kartu)] border border-garis" role="img" aria-label={t.layarAria} data-testid="kunjungan-layar" />
        <figcaption className="sr-only">{t.layarAria}</figcaption>
      </figure>
      <dl className={`mt-2 flex gap-6 text-sm ${jalan || selesai.length > 0 ? "" : "hidden"}`} data-testid="kunjungan-pintu" data-masuk={pintu.masuk} data-keluar={pintu.keluar}>
        <div className="flex items-baseline gap-2"><dt className="text-tinta-2">{t.pintuMasuk}</dt><dd className="text-lg font-semibold tabular-nums">{pintu.masuk}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="text-tinta-2">{t.pintuKeluar}</dt><dd className="text-lg font-semibold tabular-nums">{pintu.keluar}</dd></div>
      </dl>
      <p className="mt-2 text-sm text-tinta-2" aria-live="polite">
        {kemajuan ? isiTeks(t.memproses, { ke: kemajuan.ke, dari: kemajuan.dari }) + ". " : ""}
        {jalan ? isiTeks(t.terlihat, { n: terlihat }) : ""}
      </p>
      {(selesai.length > 0 || terkirim) && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="kunjungan-hasil" data-kunjungan={r.n}>
          <div><dt className="text-tinta-2">{t.hasilLabel}</dt><dd className="text-xl font-semibold tabular-nums">{r.n}</dd></div>
          <div><dt className="text-tinta-2">{t.lamaRata}</dt><dd className="font-semibold">{rata(r.lama, r.n)}</dd></div>
          <div><dt className="text-tinta-2">{t.tungguRata}</dt><dd className="font-semibold">{rata(r.tunggu, r.tungguN)}</dd></div>
          <div><dt className="text-tinta-2">{t.layanRata}</dt><dd className="font-semibold">{rata(r.layan, r.layanN)}</dd></div>
        </dl>
      )}
      {!jalan && kemajuan === null && selesai.length === 0 && terkirim ? <p className="mt-3 text-sm text-tinta-2">{t.kosong}</p> : null}
      {pesan && (
        <p role={pesan.jenis === "galat" ? "alert" : "status"} className={`mt-3 text-sm ${pesan.jenis === "galat" ? "text-cap" : ""}`} data-testid={terkirim ? "kunjungan-terkirim" : undefined}>
          {pesan.teks} {terkirim && pesan.jenis === "info" ? <a href="/app/peta-usaha" className="font-semibold underline underline-offset-4">{t.lihatPeta}</a> : null}
        </p>
      )}
    </section>
  );
}
