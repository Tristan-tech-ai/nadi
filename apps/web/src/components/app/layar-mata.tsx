"use client";

import { useEffect, useRef, useState } from "react";
import { EyeIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { catatMata, simpanZona } from "@/app/app/mata/actions";
import { langkahStatus, medianAntrean, orangDiZona, statusAwal, type Deteksi, type JenisZona, type Status, type Titik, type Zona } from "@/lib/mata/resep";

export type ModelMata = { id: string; dtype: string; ambang: number; interval_detik: number };
type Riwayat = { detik: number | null; jam: string; zona: string; nama: string; status?: string; jumlah?: number };
type Keadaan = { status: Status; jumlah: number; riwayatJumlah: number[] };

const LEBAR_KIRIM = 640;

function jamSekarang(bahasa: string) {
  return new Date().toLocaleTimeString(bahasa === "en" ? "en-GB" : "id-ID", { hour: "2-digit", minute: "2-digit" });
}
function detikTeks(d: number) {
  return `${String(Math.floor(d / 60)).padStart(2, "0")}.${String(Math.floor(d % 60)).padStart(2, "0")}`;
}

/** Mata: pilih video atau kamera, gambar zona di atas cuplikan, lalu pantau. Gambar diproses di perangkat ini dan langsung dibuang. */
export function LayarMata({ model, zonaAwal, teks: t, bahasa }: { model: ModelMata; zonaAwal: Zona[]; teks: Kamus["mata"]; bahasa: string }) {
  const JENIS: { nilai: JenisZona; label: string }[] = [
    { nilai: "meja", label: t.jMeja }, { nilai: "antrean", label: t.jAntrean }, { nilai: "kasir", label: t.jKasir },
    { nilai: "pintu", label: t.jPintu }, { nilai: "lorong", label: t.jLorong }, { nilai: "kerja", label: t.jKerja },
  ];
  const video = useRef<HTMLVideoElement>(null);
  const layar = useRef<HTMLCanvasElement>(null);
  const pekerja = useRef<Worker | null>(null);
  const berhenti = useRef(false);
  const [sumber, setSumber] = useState<"berkas" | "kamera" | null>(null);
  const [zona, setZona] = useState<Zona[]>(zonaAwal);
  const [tersimpan, setTersimpan] = useState(zonaAwal.length > 0);
  const [draf, setDraf] = useState<Titik[]>([]);
  const [namaDraf, setNamaDraf] = useState("");
  const [jenisDraf, setJenisDraf] = useState<JenisZona>("meja");
  const [orang, setOrang] = useState<Deteksi[]>([]);
  const [keadaan, setKeadaan] = useState<Record<string, Keadaan>>({});
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [pantau, setPantau] = useState(false);
  const [kemajuan, setKemajuan] = useState<{ ke: number; dari: number } | null>(null);
  const [unduh, setUnduh] = useState<number | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "info" | "galat"; teks: string } | null>(null);

  // Gambar ulang: cuplikan video, zona, titik draf, dan kotak orang.
  function gambar() {
    const c = layar.current;
    const v = video.current;
    if (!c || !v || !v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext("2d")!;
    g.drawImage(v, 0, 0, c.width, c.height);
    const tinta = getComputedStyle(document.documentElement).getPropertyValue("--tinta").trim() || "black";
    const kunyit = getComputedStyle(document.documentElement).getPropertyValue("--kunyit").trim() || "orange";
    g.lineWidth = Math.max(2, c.width / 320);
    for (const z of zona) {
      g.strokeStyle = kunyit;
      g.beginPath();
      z.poligon.forEach(([x, y], i) => (i ? g.lineTo(x * c.width, y * c.height) : g.moveTo(x * c.width, y * c.height)));
      g.closePath();
      g.stroke();
      g.fillStyle = kunyit;
      g.font = `${Math.round(c.width / 40)}px sans-serif`;
      g.fillText(z.nama, z.poligon[0][0] * c.width + 4, z.poligon[0][1] * c.height + c.width / 36);
    }
    g.strokeStyle = tinta;
    for (const o of orang) g.strokeRect(o.box.xmin * c.width, o.box.ymin * c.height, (o.box.xmax - o.box.xmin) * c.width, (o.box.ymax - o.box.ymin) * c.height);
    g.fillStyle = kunyit;
    for (const [x, y] of draf) g.fillRect(x * c.width - 4, y * c.height - 4, 8, 8);
  }
  useEffect(gambar);

  useEffect(() => () => {
    berhenti.current = true;
    pekerja.current?.terminate();
    const s = video.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
  }, []);

  function pilihBerkas(f: File | undefined) {
    if (!f || !video.current) return;
    berhenti.current = true;
    video.current.srcObject = null;
    video.current.src = URL.createObjectURL(f);
    video.current.currentTime = 0.5;
    setSumber("berkas");
    setPesan(null);
  }

  async function pakaiKamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!video.current) return;
      video.current.src = "";
      video.current.srcObject = s;
      await video.current.play();
      setSumber("kamera");
      setPesan(null);
    } catch {
      setPesan({ jenis: "galat", teks: t.kameraGagal });
    }
  }

  function klikLayar(e: React.MouseEvent<HTMLCanvasElement>) {
    if (pantau) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setDraf((d) => (d.length >= 20 ? d : [...d, [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]]));
  }

  function tambahZona() {
    if (draf.length < 3 || !namaDraf.trim()) return;
    setZona((z) => [...z, { id: "", nama: namaDraf.trim(), jenis: jenisDraf, poligon: draf }]);
    setDraf([]);
    setNamaDraf("");
    setTersimpan(false);
  }

  async function simpan() {
    const h = await simpanZona(zona.map((z) => ({ ...(z.id ? { id: z.id } : {}), nama: z.nama, jenis: z.jenis, poligon: z.poligon })));
    if ("galat" in h) return setPesan({ jenis: "galat", teks: h.galat });
    setZona(h.zona);
    setTersimpan(true);
    setPesan({ jenis: "info", teks: isiTeks(t.tersimpan, { n: h.zona.length }) });
  }

  // Satu cuplikan: kecilkan ke 640 px, deteksi di worker, kembalikan orang.
  function deteksi(): Promise<Deteksi[]> {
    const v = video.current!;
    const s = Math.min(1, LEBAR_KIRIM / v.videoWidth);
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.round(v.videoWidth * s);
    kanvas.height = Math.round(v.videoHeight * s);
    const g = kanvas.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(v, 0, 0, kanvas.width, kanvas.height);
    const data = g.getImageData(0, 0, kanvas.width, kanvas.height).data;
    pekerja.current ??= new Worker("/mata-worker.js", { type: "module" });
    const w = pekerja.current;
    const id = crypto.randomUUID();
    return new Promise((selesai, gagal) => {
      const dengar = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        if (e.data.jenis === "unduh") return setUnduh(Math.round(e.data.persen));
        w.removeEventListener("message", dengar);
        setUnduh(null);
        if (e.data.jenis === "hasil") selesai(e.data.orang as Deteksi[]);
        else gagal(new Error(e.data.pesan));
      };
      w.addEventListener("message", dengar);
      w.postMessage({ id, model: { id: model.id, dtype: model.dtype, ambang: model.ambang }, gambar: { data, lebar: kanvas.width, tinggi: kanvas.height } }, [data.buffer]);
    });
  }

  // Terapkan resep ke satu cuplikan; kembalikan butir yang berubah untuk dicatat.
  function terapkan(d: Deteksi[], detik: number | null, sebelum: Record<string, Keadaan>) {
    const baru = { ...sebelum };
    const ubah: { zona: string; status?: "kosong" | "terisi"; jumlah?: number }[] = [];
    const log: Riwayat[] = [];
    for (const z of zona) {
      const k = baru[z.id] ?? { status: statusAwal(), jumlah: 0, riwayatJumlah: [] };
      const n = orangDiZona(d, z, model.ambang);
      if (z.jenis === "meja") {
        const r = langkahStatus(k.status, n > 0);
        baru[z.id] = { ...k, status: r.status };
        if (r.berubah) {
          ubah.push({ zona: z.id, status: r.status.nilai });
          log.push({ detik, jam: jamSekarang(bahasa), zona: z.id, nama: z.nama, status: r.status.nilai });
        }
      } else {
        const riwayatJumlah = [...k.riwayatJumlah, n].slice(-3);
        const jumlah = medianAntrean(riwayatJumlah);
        baru[z.id] = { ...k, jumlah, riwayatJumlah };
        if (jumlah !== k.jumlah) {
          ubah.push({ zona: z.id, jumlah });
          log.push({ detik, jam: jamSekarang(bahasa), zona: z.id, nama: z.nama, jumlah });
        }
      }
    }
    return { baru, ubah, log };
  }

  async function mulaiPantau() {
    const v = video.current;
    if (!v || !tersimpan || !zona.length) return;
    berhenti.current = false;
    setPantau(true);
    setPesan(null);
    let k: Record<string, Keadaan> = {};
    const langkah = async (detik: number | null) => {
      const d = await deteksi();
      setOrang(d);
      const r = terapkan(d, detik, k);
      k = r.baru;
      setKeadaan(k);
      if (r.log.length) setRiwayat((x) => [...r.log, ...x].slice(0, 200));
      if (r.ubah.length) {
        const h = await catatMata(r.ubah);
        if ("galat" in h) setPesan({ jenis: "galat", teks: h.galat });
      }
    };
    try {
      if (sumber === "berkas") {
        // Berkas video: cuplik di tengah setiap selang (deterministik, secepat model), bukan menunggu video berjalan.
        const selang = model.interval_detik;
        const n = Math.floor(v.duration / selang);
        for (let i = 0; i < n && !berhenti.current; i++) {
          const t = i * selang + selang / 2;
          await new Promise<void>((ok) => {
            v.addEventListener("seeked", () => ok(), { once: true });
            v.currentTime = t;
          });
          setKemajuan({ ke: i + 1, dari: n });
          await langkah(t);
        }
        if (!berhenti.current) setPesan({ jenis: "info", teks: t.videoSelesai });
      } else {
        while (!berhenti.current) {
          await langkah(null);
          await new Promise((ok) => setTimeout(ok, model.interval_detik * 1000));
        }
      }
    } catch {
      setPesan({ jenis: "galat", teks: t.modelGagal });
    } finally {
      setPantau(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-isian)] border border-garis-kuat px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tinta">
            <VideoCameraIcon size={18} aria-hidden /> {t.pilihVideo}
            <input type="file" accept="video/*" className="sr-only" data-testid="pilih-video" onChange={(e) => pilihBerkas(e.target.files?.[0])} />
          </label>
          <Tombol ragam="kedua" onClick={pakaiKamera} disabled={pantau}>{t.pakaiKamera}</Tombol>
        </div>
        <video ref={video} muted playsInline className="hidden" onLoadedData={gambar} onSeeked={gambar} onTimeUpdate={gambar} />
        {sumber ? (
          <canvas ref={layar} onClick={klikLayar} className="mt-4 w-full cursor-crosshair rounded-[var(--radius-kartu)] border border-garis" data-testid="layar-mata"
            role="img" aria-label={t.layarAria} />
        ) : (
          <p className="mt-4 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-sm text-tinta-2" data-testid="mata-kosong">
            {t.kosong}
          </p>
        )}
        {sumber && !pantau ? (
          <fieldset className="mt-4 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4">
            <legend className="px-1 text-sm font-semibold">{t.zonaBaru}</legend>
            <p className="text-sm text-tinta-2">{isiTeks(t.klikSudut, { n: draf.length })}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{t.namaZona}
                <input value={namaDraf} onChange={(e) => setNamaDraf(e.target.value)} maxLength={60} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" placeholder={t.namaContoh} />
              </label>
              <label className="grid gap-1 text-sm">{t.jenis}
                <select value={jenisDraf} onChange={(e) => setJenisDraf(e.target.value as JenisZona)} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base">
                  {JENIS.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Tombol ragam="kedua" onClick={tambahZona} disabled={draf.length < 3 || !namaDraf.trim()}>{t.tambahZona}</Tombol>
              <Tombol ragam="teks" onClick={() => setDraf((d) => d.slice(0, -1))} disabled={!draf.length}>{t.hapusTitik}</Tombol>
            </div>
          </fieldset>
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t.zona}</h2>
        {zona.length ? (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-zona">
            {zona.map((z, i) => {
              const k = keadaan[z.id];
              const teks = z.jenis === "meja" ? (k ? (k.status.nilai === "terisi" ? t.terisi : t.kosongStatus) : t.belumDipantau) : k ? isiTeks(t.orang, { n: k.jumlah }) : t.belumDipantau;
              return (
                <li key={z.id || `baru-${i}`} className="flex items-center justify-between gap-3 py-2" data-testid="zona-mata" data-nama={z.nama} data-status={z.jenis === "meja" ? k?.status.nilai ?? "" : String(k?.jumlah ?? "")}>
                  <span className="min-w-0">
                    <span className="font-semibold" data-pengguna>{z.nama}</span>
                    <span className="block text-sm text-tinta-2">{z.jenis === "meja" ? t.meja : z.jenis === "antrean" ? t.antrean : t.rak}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm">{teks}</span>
                    {!pantau ? (
                      <button type="button" className="text-sm text-tinta-2 underline-offset-4 hover:underline" onClick={() => { setZona((x) => x.filter((_, j) => j !== i)); setTersimpan(false); }}>
                        {t.hapus}<span className="sr-only">{isiTeks(t.hapusZona, { nama: z.nama })}</span>
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-tinta-2">{t.tanpaZona}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {!tersimpan ? <Tombol onClick={simpan} disabled={pantau}>{t.simpanZona}</Tombol> : null}
          {pantau ? (
            <Tombol ragam="kedua" onClick={() => { berhenti.current = true; }}>{t.berhenti}</Tombol>
          ) : (
            <Tombol onClick={mulaiPantau} disabled={!sumber || !tersimpan || !zona.length} data-testid="mulai-pantau">
              <EyeIcon size={18} aria-hidden /> {t.mulaiPantau}
            </Tombol>
          )}
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm" data-testid="mata-status">
          {unduh !== null ? isiTeks(t.menyiapkan, { n: unduh }) : kemajuan && pantau ? isiTeks(t.cuplikan, { ke: kemajuan.ke, dari: kemajuan.dari }) : pesan?.jenis === "info" ? pesan.teks : ""}
        </p>
        {pesan?.jenis === "galat" ? <p role="alert" className="text-sm text-cap">{pesan.teks}</p> : null}

        <h2 className="mt-6 text-lg font-semibold">{t.perubahan}</h2>
        {riwayat.length ? (
          <ol className="mt-2 max-h-80 divide-y divide-garis overflow-y-auto border-y border-garis text-sm" data-testid="riwayat-mata" tabIndex={0} aria-label={t.perubahanAria}>
            {riwayat.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5" data-detik={r.detik ?? ""} data-zona={r.nama} data-status={r.status ?? String(r.jumlah ?? "")}>
                <span><span data-pengguna>{r.nama}</span>: {r.status ? (r.status === "terisi" ? t.terisiKecil : t.kosongKecil) : isiTeks(t.orang, { n: r.jumlah ?? 0 })}</span>
                <span className="angka text-tinta-2">{r.detik !== null ? isiTeks(t.video, { t: detikTeks(r.detik) }) : r.jam}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-tinta-2">{t.belumPerubahan}</p>
        )}
      </div>
    </div>
  );
}
