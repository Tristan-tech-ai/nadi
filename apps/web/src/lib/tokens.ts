// Token warna Nadi (docs/design/DIRECTION.md §2). Sumber kebenaran untuk tes kontras; globals.css harus memuat nilai yang sama
// (tokens.test.ts membandingkan keduanya agar tidak menyimpang).
export const WARNA = {
  kertas: { terang: "#F6F2EA", gelap: "#141311" },
  "kertas-2": { terang: "#EFE9DD", gelap: "#1C1A17" },
  tinta: { terang: "#1C1B18", gelap: "#ECE7DD" },
  "tinta-2": { terang: "#5B574F", gelap: "#A8A196" },
  garis: { terang: "#DDD5C6", gelap: "#2E2B26" },
  "garis-kuat": { terang: "#8C8476", gelap: "#6E685D" },
  kunyit: { terang: "#E9A825", gelap: "#F0B53D" },
  cap: { terang: "#B4372A", gelap: "#E0654F" },
  daun: { terang: "#23704A", gelap: "#4FB07F" },
  laut: { terang: "#2D5B86", gelap: "#78A6D6" },
} as const;

export type NamaWarna = keyof typeof WARNA;

function luminans(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rasio kontras WCAG 2.x antara dua warna heksadesimal. */
export function kontras(a: string, b: string): number {
  const [l1, l2] = [luminans(a), luminans(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
