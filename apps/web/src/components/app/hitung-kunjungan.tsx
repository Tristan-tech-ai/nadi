"use client";

import { useEffect, useRef, useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { aturPapan, kirimRekap } from "@/app/app/mata/actions";
import { abuDari, deteksi, formatDurasi, latarDari, Pelacak, rekapJam, type Kunjungan, type ZonaV2 } from "@/lib/mata/jejak";

// W-02 Mata v2: kamera atas atau rekaman diproses di perangkat ini (beda latar + pelacak posisi, src/lib/mata/jejak.ts).
// Bingkai diperkecil ke 160 px, dibaca, lalu dibuang. Yang dikirim hanya rekap per jam (jumlah dan detik).
const LEBAR = 160;
const FPS = 5;
const KIRIM_TIAP_MS = 5 * 60 * 1000;

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

export function HitungKunjungan({ zona, papanAwal, teks: t, bahasa }: { zona: ZonaV2[]; papanAwal: boolean; teks: Kamus["kunjungan"]; bahasa: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const pratinjau = useRef<HTMLCanvasElement>(null);
  const berhenti = useRef(false);
  const [papan, setPapan] = useState(papanAwal);
  const [jalan, setJalan] = useState(false);
  const [kemajuan, setKemajuan] = useState<{ ke: number; dari: number } | null>(null);
  const [terlihat, setTerlihat] = useState(0);
  const [selesai, setSelesai] = useState<Kunjungan[]>([]);
  const [pesan, setPesan] = useState<{ jenis: "info" | "galat"; teks: string } | null>(null);
  const [terkirim, setTerkirim] = useState(false);
  const adaPintu = zona.some((z) => z.jenis === "pintu");

  useEffect(() => () => {
    berhenti.current = true;
    (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((x) => x.stop());
  }, []);

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

  function gambarTitik(titik: { x: number; y: number }[]) {
    const c = pratinjau.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const tinta = getComputedStyle(document.documentElement).getPropertyValue("--kunyit").trim() || "orange";
    g.fillStyle = tinta;
    for (const p of titik) g.fillRect(p.x * c.width - 3, p.y * c.height - 3, 6, 6);
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
    const n = Math.floor(v.duration * FPS);
    // Rekaman dianggap baru selesai: detik 0 = sekarang dikurangi panjang video.
    const asalMs = Date.now() - v.duration * 1000;
    const p = new Pelacak(zona);
    const hasil: Kunjungan[] = [];
    let latar: Float32Array | null = null;
    for (let i = 0; i < n && !berhenti.current; i++) {
      await new Promise<void>((ok) => {
        v.addEventListener("seeked", () => ok(), { once: true });
        v.currentTime = i / FPS;
      });
      const b = bingkai(v, c);
      if (!latar) {
        latar = latarDari(b);
        continue;
      }
      hasil.push(...p.langkah(i / FPS, deteksi(latar, b)));
      if (i % 5 === 0) {
        gambarTitik(p.terlihat);
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

  async function dariKamera() {
    const v = video.current;
    const c = pratinjau.current;
    if (!v || !c) return;
    let aliran: MediaStream;
    try {
      aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      return setPesan({ jenis: "galat", teks: t.gagalVideo });
    }
    v.src = "";
    v.srcObject = aliran;
    await v.play();
    setPesan(null);
    setSelesai([]);
    setTerkirim(false);
    berhenti.current = false;
    setJalan(true);
    const asalMs = Date.now();
    const sesi = `kamera-${asalMs}`;
    const p = new Pelacak(zona);
    let latar: Float32Array | null = null;
    let tertunda: Kunjungan[] = [];
    const semua: Kunjungan[] = [];
    let kirimAkhir = Date.now();
    let ke = 0;
    while (!berhenti.current) {
      const b = bingkai(v, c);
      const t0 = (Date.now() - asalMs) / 1000;
      if (!latar) latar = latarDari(b);
      else {
        const k = p.langkah(t0, deteksi(latar, b));
        tertunda.push(...k);
        semua.push(...k);
        gambarTitik(p.terlihat);
        setTerlihat(p.terlihat.length);
        setSelesai([...semua]);
      }
      if (Date.now() - kirimAkhir > KIRIM_TIAP_MS && tertunda.length) {
        if (await kirim(tertunda, asalMs, `${sesi}-${ke++}`)) tertunda = [];
        kirimAkhir = Date.now();
      }
      await new Promise((ok) => setTimeout(ok, 1000 / FPS));
    }
    const akhir = p.selesai();
    tertunda.push(...akhir);
    semua.push(...akhir);
    setSelesai(semua);
    aliran.getTracks().forEach((x) => x.stop());
    setJalan(false);
    await kirim(tertunda, asalMs, `${sesi}-${ke}`);
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
      <video ref={video} className="hidden" muted playsInline />
      <canvas ref={pratinjau} className={`mt-4 w-full max-w-sm rounded-[var(--radius-kartu)] border border-garis ${jalan ? "" : "hidden"}`} aria-hidden />
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
