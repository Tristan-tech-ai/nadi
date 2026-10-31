"use client";

import { useState } from "react";
import { Cap } from "@/components/ui/cap";
import { Tombol } from "@/components/ui/tombol";

/** Setujui/Tolak di usaha contoh: hanya di layar, tidak disimpan. */
export function PutusanDemo() {
  const [status, setStatus] = useState<"diterima" | "ditolak" | null>(null);
  if (status)
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm" data-testid="hasil-demo">
        <Cap jenis={status} />
        <span>Di usaha contoh, keputusan tidak disimpan.</span>
        <button type="button" onClick={() => setStatus(null)} className="font-semibold underline underline-offset-4">Ulangi</button>
      </p>
    );
  return (
    <div className="flex w-full gap-2">
      <Tombol ukuran="besar" className="flex-1" onClick={() => setStatus("diterima")}>Setujui</Tombol>
      <Tombol ukuran="besar" ragam="kedua" onClick={() => setStatus("ditolak")}>Tolak</Tombol>
    </div>
  );
}
