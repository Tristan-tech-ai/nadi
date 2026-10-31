"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ambilKodeKios, type KodeKios } from "@/app/kios/actions";

/** Layar kios: QR absen yang berganti tiap 15 detik, dengan kode angka dan hitung mundur. `ambil` default lewat sesi pemilik/admin. */
export function LayarKios({ ambil = ambilKodeKios }: { ambil?: () => Promise<KodeKios> }) {
  const [k, setK] = useState<KodeKios | null>(null);
  const [svg, setSvg] = useState("");
  const [sisa, setSisa] = useState(0);

  useEffect(() => {
    let aktif = true;
    let jeda: ReturnType<typeof setTimeout>;
    const muat = async () => {
      const baru = await ambil().catch((): KodeKios => ({ galat: "Kode absen gagal dimuat. Periksa internet tablet ini." }));
      if (!aktif) return;
      setK(baru);
      if ("kode" in baru) {
        const url = `${window.location.origin}/absen?t=${baru.tempat}&k=${baru.kode}`;
        setSvg(await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1C1B18", light: "#FFFFFF" } })); // slop-ok: QR harus kontras hitam di atas putih agar terbaca kamera
        setSisa(baru.sisa);
        jeda = setTimeout(muat, baru.sisa * 1000 + 150);
      } else jeda = setTimeout(muat, 10_000);
    };
    muat();
    const detik = setInterval(() => setSisa((s) => Math.max(0, s - 1)), 1000);
    return () => {
      aktif = false;
      clearTimeout(jeda);
      clearInterval(detik);
    };
  }, [ambil]);

  if (!k) return <div className="mx-auto aspect-square w-full max-w-md animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />;
  if ("galat" in k) return <p role="alert" className="text-lg text-tinta-2">{k.galat}</p>;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-md rounded-[var(--radius-kartu)] bg-white p-4" role="img" aria-label="Kode QR absen" data-testid="qr-kios" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="font-mono text-5xl font-medium tracking-[0.2em]" data-testid="kode-kios" aria-live="polite">{k.kode}</p>
      <p className="text-tinta-2" data-testid="sisa-kios">Berganti dalam <span className="angka font-semibold text-tinta">{sisa}</span> detik</p>
    </div>
  );
}
