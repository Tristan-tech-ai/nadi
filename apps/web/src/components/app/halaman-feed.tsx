"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { hrefFeed, offsetBerikut, type Tampilan } from "@/lib/feed";

// D-05B: kartu yang diputuskan tetap tampil dengan capnya, tetapi di database ia tidak lagi menunggu. Halaman ini menghitung
// berapa yang sudah diputuskan agar tautan "Lihat berikutnya" mundur sebanyak itu dan tidak melewatkan usulan.
const CatatPutusan = createContext<() => void>(() => {});
const JumlahPutusan = createContext(0);

export function HalamanFeed({ children }: { children: ReactNode }) {
  const [jumlah, setJumlah] = useState(0);
  const catat = useCallback(() => setJumlah((n) => n + 1), []);
  return (
    <CatatPutusan value={catat}>
      <JumlahPutusan value={jumlah}>{children}</JumlahPutusan>
    </CatatPutusan>
  );
}

/** Dipanggil kartu Feed sekali setelah usulannya berhasil disetujui atau ditolak. Di luar HalamanFeed tidak berbuat apa-apa. */
export function useCatatPutusan() {
  return useContext(CatatPutusan);
}

export function TautanBerikut({ t, berikut, className, children }: { t: Tampilan; berikut: number; className: string; children: ReactNode }) {
  const diputuskan = useContext(JumlahPutusan);
  return (
    <Link href={hrefFeed({ ...t, lagi: offsetBerikut(berikut, diputuskan) })} className={className} data-testid="lihat-berikutnya">
      {children}
    </Link>
  );
}
