// Skor IPIP sesuai petunjuk resmi https://ipip.ori.org/newScoringInstructions.htm (diakses 31 Okt 2026):
// butir + dinilai 1 (Very Inaccurate) sampai 5 (Very Accurate), butir - dibalik (5 sampai 1), skor skala = jumlah nilai butir.
// Tanpa norma Indonesia, skor ditampilkan apa adanya (10-50 per faktor) dan tidak dipakai untuk meranking atau menggugurkan pelamar.
import { IPIP_50 } from "./ipip-50";

/** Label pilihan jawaban. Terjemahan sendiri dari label resmi (halaman terjemahan tidak mencantumkan label Indonesia). */
export const PILIHAN_IPIP = [
  { nilai: 1, label: "Sangat tidak sesuai", en: "Very Inaccurate" },
  { nilai: 2, label: "Agak tidak sesuai", en: "Moderately Inaccurate" },
  { nilai: 3, label: "Antara sesuai dan tidak", en: "Neither Inaccurate nor Accurate" },
  { nilai: 4, label: "Agak sesuai", en: "Moderately Accurate" },
  { nilai: 5, label: "Sangat sesuai", en: "Very Accurate" },
] as const;

export const FAKTOR_IPIP = { 1: "Ekstraversi", 2: "Keramahan", 3: "Ketelitian", 4: "Kestabilan emosi", 5: "Intelek dan imajinasi" } as const;
export type Faktor = keyof typeof FAKTOR_IPIP;

/** Jawaban: nomor butir -> pilihan 1..5. Faktor yang punya butir belum dijawab bernilai null (petunjuk resmi tidak mengatur data hilang). */
export function skorIpip(jawaban: Record<number, number>): Record<Faktor, number | null> {
  const hasil = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Faktor, number | null>;
  for (const b of IPIP_50) {
    const j = jawaban[b.no];
    if (hasil[b.faktor] === null) continue;
    if (!Number.isInteger(j) || j < 1 || j > 5) {
      hasil[b.faktor] = null;
      continue;
    }
    hasil[b.faktor] = (hasil[b.faktor] as number) + (b.kunci === "+" ? j : 6 - j);
  }
  return hasil;
}
