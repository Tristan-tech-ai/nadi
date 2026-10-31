"use client";

import { useEffect, useRef, useState } from "react";
import { BATAS, nilaiWajah, yawDariLandmark, type Arah, type Bingkai, type Penilaian } from "@/lib/absen/wajah";

// MediaPipe Face Landmarker di perangkat (docs/research/absen.md). Gambar kamera tidak pernah dikirim ke mana pun.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL = "/mediapipe/face_landmarker.task";
const BATAS_WAKTU_MS = 15_000;

/** Kamera depan + tantangan kedip dan menoleh. Memanggil `selesai` sekali: lulus, atau gagal dengan alasan. */
export function CekWajah({ arah, selesai }: { arah: Arah; selesai: (p: Penilaian) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Menyiapkan kamera...");

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
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const berkas = await FilesetResolver.forVisionTasks(WASM);
        const buat = (delegate: "GPU" | "CPU") => FaceLandmarker.createFromOptions(berkas, {
          baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numFaces: 2, outputFaceBlendshapes: true,
        });
        const lm = await buat("GPU").catch(() => buat("CPU"));
        penanda = lm;
        if (batal) return lm.close();
        setStatus(`Kedipkan mata sekali, lalu tolehkan kepala ke ${arah}mu.`);
        const bingkai: Bingkai[] = [];
        const mulai = performance.now();
        const langkah = () => {
          if (batal) return;
          const kini = performance.now();
          const h = lm.detectForVideo(v, kini);
          const muka = h.faceLandmarks[0];
          const skor = (n: string) => h.faceBlendshapes[0]?.categories.find((c) => c.categoryName === n)?.score ?? 0;
          bingkai.push({
            wajah: h.faceLandmarks.length,
            kedip: (skor("eyeBlinkLeft") + skor("eyeBlinkRight")) / 2,
            yaw: muka ? yawDariLandmark(muka[1].x, muka[234].x, muka[454].x) : 0,
          });
          const p = nilaiWajah(bingkai, arah);
          if (p.lulus) return akhiri(p);
          if (kini - mulai > BATAS_WAKTU_MS) return akhiri(bingkai.filter((b) => b.wajah === 1).length < BATAS.minBingkai ? p : { ...p, alasan: p.alasan || "Waktu habis. Coba lagi." });
          raf = requestAnimationFrame(langkah);
        };
        raf = requestAnimationFrame(langkah);
      } catch {
        akhiri({ lulus: false, kedip: false, menoleh: "", alasan: "Kamera tidak bisa dibuka. Izinkan akses kamera untuk Nadi, lalu coba lagi." });
      }
    })();
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      aliran?.getTracks().forEach((t) => t.stop());
      penanda?.close();
    };
  }, [arah, selesai]);

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-[var(--radius-kartu)] bg-kertas-2">
        {/* Pratinjau dicerminkan agar terasa seperti cermin; analisis memakai gambar asli. */}
        <video ref={video} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label="Pratinjau kamera depan" />
      </div>
      <p role="status" className="text-center text-sm" data-testid="status-wajah">{status}</p>
    </div>
  );
}
