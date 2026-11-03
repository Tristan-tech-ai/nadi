"use client";

import { useEffect, useRef, useState } from "react";
import { BATAS, bingkaiDari, nilaiWajah, type Arah, type Bingkai, type HasilDeteksi, type Penilaian } from "@/lib/absen/wajah";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

// MediaPipe Face Landmarker di perangkat (docs/research/absen.md). Gambar kamera tidak pernah dikirim ke mana pun.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL = "/mediapipe/face_landmarker.task";
const BATAS_WAKTU_MS = 15_000;
// Q-20: hanya build lokal e2e (next.config env). Di produksi nilainya "0", sehingga cabang uji dihapus saat build.
const UJI_WAJAH = process.env.NEXT_PUBLIC_NADI_UJI_WAJAH === "1";
type SumberUji = Record<Arah, HasilDeteksi[]>;

/** Kamera depan + tantangan kedip dan menoleh. Memanggil `selesai` sekali: lulus, atau gagal dengan alasan. */
export function CekWajah({ arah, selesai, teks: t }: { arah: Arah; selesai: (p: Penilaian) => void; teks: Kamus["absen"] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState(t.menyiapkanKamera);

  useEffect(() => {
    let batal = false;
    let aliran: MediaStream | null = null;
    let penanda: { close(): void } | null = null;
    let raf = 0;
    const akhiri = (p: Penilaian) => {
      if (batal) return;
      batal = true;
      cancelAnimationFrame(raf);
      aliran?.getTracks().forEach((t) => t.stop());
      penanda?.close();
      selesai(p);
    };
    (async () => {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
        const v = video.current!;
        v.srcObject = aliran;
        await v.play();
        const uji = UJI_WAJAH ? (window as unknown as { __nadiUjiWajah?: SumberUji }).__nadiUjiWajah?.[arah] : undefined;
        if (uji) {
          // e2e lokal: hasil deteksi dari fixture landmark (sama dengan tes unit), lewat bingkaiDari dan nilaiWajah yang sama.
          setStatus(isiTeks(t.kedipToleh, { arah: t[arah] }));
          const b = uji.map(bingkaiDari);
          return akhiri(nilaiWajah(b, arah, t));
        }
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const berkas = await FilesetResolver.forVisionTasks(WASM);
        const buat = (delegate: "GPU" | "CPU") => FaceLandmarker.createFromOptions(berkas, {
          baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numFaces: 2, outputFaceBlendshapes: true,
        });
        const lm = await buat("GPU").catch(() => buat("CPU"));
        penanda = lm;
        if (batal) return lm.close();
        setStatus(isiTeks(t.kedipToleh, { arah: t[arah] }));
        const bingkai: Bingkai[] = [];
        const mulai = performance.now();
        const langkah = () => {
          if (batal) return;
          const kini = performance.now();
          bingkai.push(bingkaiDari(lm.detectForVideo(v, kini)));
          const p = nilaiWajah(bingkai, arah, t);
          if (p.lulus) return akhiri(p);
          if (kini - mulai > BATAS_WAKTU_MS) return akhiri(bingkai.filter((b) => b.wajah === 1).length < BATAS.minBingkai ? p : { ...p, alasan: p.alasan || t.waktuHabis });
          raf = requestAnimationFrame(langkah);
        };
        raf = requestAnimationFrame(langkah);
      } catch {
        akhiri({ lulus: false, kedip: false, menoleh: "", alasan: t.kameraGagal });
      }
    })();
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      aliran?.getTracks().forEach((t) => t.stop());
      penanda?.close();
    };
  }, [arah, selesai, t]);

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-[var(--radius-kartu)] bg-kertas-2">
        {/* Pratinjau dicerminkan agar terasa seperti cermin; analisis memakai gambar asli. */}
        <video ref={video} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label={t.pratinjau} />
      </div>
      <p role="status" className="text-center text-sm" data-testid="status-wajah">{status}</p>
    </div>
  );
}
