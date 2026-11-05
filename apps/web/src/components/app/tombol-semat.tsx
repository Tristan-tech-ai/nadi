"use client";

// U-09: sematkan halaman ini di bagian Disematkan sidebar (hanya tampil >= 1200 px, tempat sidebar ada).
import { useEffect, useState } from "react";
import { PushPinIcon } from "@phosphor-icons/react";
import { PERISTIWA_SEMAT, bacaSematan, gantiSematan } from "@/lib/sematan";

export function TombolSemat({ href, peran, label }: { href: string; peran: string; label: [string, string] }) {
  const [tersemat, setTersemat] = useState(false);
  useEffect(() => {
    const segarkan = () => setTersemat(bacaSematan(peran).includes(href));
    segarkan();
    window.addEventListener(PERISTIWA_SEMAT, segarkan);
    return () => window.removeEventListener(PERISTIWA_SEMAT, segarkan);
  }, [href, peran]);
  return (
    <button type="button" data-tersemat={tersemat ? "ya" : "tidak"} onClick={() => setTersemat(gantiSematan(peran, href).includes(href))}
      className="hidden h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-garis px-3 text-tinta-2 hover:bg-kertas-2 hover:text-tinta data-[tersemat=ya]:bg-kertas-2 data-[tersemat=ya]:text-tinta min-[1200px]:inline-flex">
      <PushPinIcon size={18} weight={tersemat ? "fill" : "regular"} aria-hidden /><span className="text-sm font-semibold">{tersemat ? label[1] : label[0]}</span>
    </button>
  );
}
