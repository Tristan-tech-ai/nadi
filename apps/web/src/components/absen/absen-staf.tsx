"use client";

import { useCallback, useState, useTransition } from "react";
import { catatAbsen, type HasilAbsen } from "@/app/absen/actions";
import { Cap } from "@/components/ui/cap";
import { Tombol } from "@/components/ui/tombol";
import { tantanganAcak, type Arah, type Penilaian } from "@/lib/absen/wajah";
import type { Kamus } from "@/lib/i18n/kamus";
import { CekWajah } from "./cek-wajah";

type Jenis = "absen.masuk" | "absen.pulang";

/** Alur staf setelah memindai QR: pilih masuk/pulang, cek wajah di perangkat, lalu catat. */
export function AbsenStaf({ tempat, kode, teks: t }: { tempat: string; kode: string; teks: Kamus["absen"] }) {
  const [jenis, setJenis] = useState<Jenis | null>(null);
  const [arah, setArah] = useState<Arah>("kiri");
  const [hasil, setHasil] = useState<HasilAbsen | null>(null);
  const [sibuk, mulai] = useTransition();

  const pilih = (j: Jenis) => {
    setHasil(null);
    setArah(tantanganAcak());
    setJenis(j);
  };
  const selesai = useCallback((p: Penilaian) => {
    if (!jenis) return;
    if (!p.lulus) {
      setJenis(null);
      setHasil({ galat: p.alasan });
      return;
    }
    mulai(async () => {
      setHasil(await catatAbsen(tempat, kode, jenis, { lulus: true, kedip: p.kedip, menoleh: p.menoleh }));
      setJenis(null);
    });
  }, [jenis, tempat, kode]);

  if (jenis && !sibuk) return <CekWajah arah={arah} selesai={selesai} teks={t} />;
  return (
    <div className="space-y-5">
      {hasil?.ok ? (
        <p role="status" className="flex flex-wrap items-center gap-2" data-testid="hasil-absen"><Cap jenis="diterima" label={t.tercatat} /> {hasil.ok}</p>
      ) : hasil?.galat ? (
        <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap" data-testid="galat-absen">{hasil.galat}</p>
      ) : null}
      {sibuk ? <p role="status" className="text-sm text-tinta-2">{t.menyimpan}</p> : null}
      {!hasil?.ok ? (
        <div className="grid gap-3">
          <Tombol ukuran="besar" onClick={() => pilih("absen.masuk")} disabled={sibuk}>{t.masuk}</Tombol>
          <Tombol ukuran="besar" ragam="kedua" onClick={() => pilih("absen.pulang")} disabled={sibuk}>{t.pulang}</Tombol>
        </div>
      ) : null}
      <p className="text-xs text-tinta-2">{t.kameraKet}</p>
    </div>
  );
}
