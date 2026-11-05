// U-09 halaman Disematkan di sidebar: bawaan per peran, pilihan pengguna disimpan per perangkat (localStorage; kenyamanan, bukan data).
export const PERISTIWA_SEMAT = "nadi:sematan";
const KUNCI = "nadi:sematan";
export const MAKS_SEMAT = 8;

export const SEMATAN_BAWAAN: Record<string, string[]> = {
  pemilik: ["/app", "/app/lempar", "/app/invoice", "/app/gaji", "/app/buku"],
  admin: ["/app", "/app/lempar", "/app/orang", "/app/gaji", "/app/izin"],
  akuntan: ["/app", "/app/lempar", "/app/buku", "/app/kas", "/app/pajak"],
  staf: ["/app", "/app/kerja", "/app/izin", "/app/gaji", "/app/klaim"],
};

export function bacaSematan(peran: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(`${KUNCI}:${peran}`) ?? "null");
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.slice(0, MAKS_SEMAT);
  } catch { /* tanpa penyimpanan: pakai bawaan */ }
  return SEMATAN_BAWAAN[peran] ?? SEMATAN_BAWAAN.pemilik;
}

/** Sematkan atau lepas satu halaman; mengembalikan daftar baru dan memberi tahu sidebar. */
export function gantiSematan(peran: string, href: string): string[] {
  const kini = bacaSematan(peran);
  const baru = kini.includes(href) ? kini.filter((x) => x !== href) : [...kini, href].slice(-MAKS_SEMAT);
  try { localStorage.setItem(`${KUNCI}:${peran}`, JSON.stringify(baru)); } catch { /* abaikan */ }
  window.dispatchEvent(new Event(PERISTIWA_SEMAT));
  return baru;
}

/** Sudah pernah diubah pengguna di perangkat ini (petunjuk cara menyematkan berhenti tampil). */
export function sematanDiatur(peran: string): boolean {
  try { return localStorage.getItem(`${KUNCI}:${peran}`) !== null; } catch { return false; }
}
