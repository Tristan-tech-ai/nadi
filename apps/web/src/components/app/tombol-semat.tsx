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
    <button type="button" aria-pressed={tersemat} title={tersemat ? label[1] : label[0]} onClick={() => setTersemat(gantiSematan(peran, href).includes(href))}
      className="hidden size-10 items-center justify-center rounded-full border border-garis text-tinta-2 hover:bg-kertas-2 hover:text-tinta aria-pressed:text-tinta min-[1200px]:inline-flex">
      <PushPinIcon size={18} weight={tersemat ? "fill" : "regular"} aria-hidden /><span className="sr-only">{label[0]}</span>
    </button>
  );
}
