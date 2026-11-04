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

// Lapangan warna poster untuk permukaan Persuade (landing, halaman fitur, video; docs/design/DESIGN.md). Setiap lapangan punya
// tinta sendiri; tombol di dalam lapangan memakai tinta sebagai latar dan warna lapangan sebagai teks. Pasangan gelap mengikuti
// tema perangkat: warna jenuh menjadi versi malamnya dengan tinta terang.
export const POSTER = {
  kunyit: { terang: ["#E9A825", "#1C1B18"], gelap: ["#3B2D0B", "#F6D27A"] },
  tinta: { terang: ["#1C1B18", "#FBFAF6"], gelap: ["#0B0A09", "#ECE7DD"] },
  cap: { terang: ["#A63225", "#FFFDF8"], gelap: ["#4C1B15", "#F6C3B8"] },
  laut: { terang: ["#1A3796", "#FFFDF8"], gelap: ["#101F55", "#CBD6FF"] },
  daun: { terang: ["#23704A", "#FFFDF8"], gelap: ["#0F3321", "#B7E8CA"] },
  tulang: { terang: ["#F3F1EC", "#1C1B18"], gelap: ["#171614", "#ECE7DD"] },
  lembar: { terang: ["#FFFDF8", "#1C1B18"], gelap: ["#262420", "#ECE7DD"] },
} as const;

// Aksen di dalam lapangan: sorot (judul baris kedua, angka), stempel (cap merah di lembar), lunas (cap hijau di lembar).
export const AKSEN = {
  sorot: { terang: "#E9A825", gelap: "#F0B53D" },
  stempel: { terang: "#B4372A", gelap: "#F08A76" },
  lunas: { terang: "#23704A", gelap: "#6FCF9B" },
} as const;

export type NamaLapangan = keyof typeof POSTER;

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
