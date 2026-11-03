// Bahasa tampilan (I-02, docs/research/i18n.md). Bawaan Indonesia; Inggris lewat /en untuk halaman publik dan pilihan
// pengguna (cookie nadi_bahasa + user_metadata.bahasa) di aplikasi. Mata uang dan zona waktu mengikuti usaha, bukan bahasa.
export const BAHASA = ["id", "en"] as const;
export type Bahasa = (typeof BAHASA)[number];
export const BAHASA_BAWAAN: Bahasa = "id";
export const KUKI_BAHASA = "nadi_bahasa";
/** Umur cookie pilihan bahasa: satu tahun (detik). */
export const UMUR_KUKI_BAHASA = 60 * 60 * 24 * 365;

export function adaBahasa(nilai: unknown): nilai is Bahasa {
  return typeof nilai === "string" && (BAHASA as readonly string[]).includes(nilai);
}

/** Pilihan tersimpan pengguna menang, lalu cookie, lalu bawaan. Accept-Language sengaja tidak dipakai untuk mengalihkan. */
export function pilihBahasa(...kandidat: unknown[]): Bahasa {
  for (const k of kandidat) if (adaBahasa(k)) return k;
  return BAHASA_BAWAAN;
}

/** Lokal Intl untuk angka dan tanggal. */
export function lokalIntl(b: Bahasa): string {
  return b === "en" ? "en-US" : "id-ID";
}

/** Awalan jalur halaman publik: "" untuk Indonesia, "/en" untuk Inggris. */
export function awalanJalur(b: Bahasa): string {
  return b === "id" ? "" : `/${b}`;
}

/** Jalur yang sama di bahasa lain: /en/harga <-> /harga. */
export function jalurBahasa(jalur: string, tujuan: Bahasa): string {
  const tanpa = jalur.replace(/^\/en(?=\/|$)/, "") || "/";
  const awal = awalanJalur(tujuan);
  return awal ? (tanpa === "/" ? awal : awal + tanpa) : tanpa;
}

/** Halaman publik yang sudah punya versi Inggris (ditambah di I-03). Jalur lain diarahkan ke beranda bahasa tujuan. */
export const JALUR_DUA_BAHASA = ["/", "/harga", "/keamanan", "/privasi", "/syarat"];

/** Tujuan pemilih bahasa dari jalur sekarang. */
export function tujuanPemilih(jalur: string, tujuan: Bahasa): string {
  const dasar = jalurBahasa(jalur, "id");
  return JALUR_DUA_BAHASA.includes(dasar) ? jalurBahasa(dasar, tujuan) : jalurBahasa("/", tujuan);
}
