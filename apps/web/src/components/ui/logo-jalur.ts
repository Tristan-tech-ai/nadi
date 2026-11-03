// Bentuk tanda Nadi (D-10, docs/design/iterasi/logo): huruf n dari secarik kertas nota yang kedua kakinya sobek, dan satu titik
// denyut kunyit. Satu sumber untuk komponen React dan skrip ikon (scripts/buat-ikon.mjs). Kotak 32 x 32.
export const KOTAK_TANDA = 32;
export const JALUR_N =
  "M5 27.5L6.75 26 8.5 27.5 10.25 26 12 27.5V15a4 4 0 0 1 8 0V27.5L21.75 26 23.5 27.5 25.25 26 27 27.5V15A11 11 0 0 0 5 15Z";
export const TITIK = { cx: 27.5, cy: 4.5, r: 3 } as const;

/** SVG mandiri (untuk ikon PNG dan favicon) dengan warna eksplisit. */
export function svgTanda(tinta: string, kunyit: string, latar?: string, pad = 0): string {
  const s = (KOTAK_TANDA - 2 * pad) / KOTAK_TANDA;
  const isi = `<g transform="translate(${pad} ${pad}) scale(${s})"><path d="${JALUR_N}" fill="${tinta}"/><circle cx="${TITIK.cx}" cy="${TITIK.cy}" r="${TITIK.r}" fill="${kunyit}"/></g>`;
  const bg = latar ? `<rect width="32" height="32" fill="${latar}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg}${isi}</svg>`;
}
