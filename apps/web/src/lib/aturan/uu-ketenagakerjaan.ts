// Q-52: UU 27/2026 tentang Pelindungan Ketenagakerjaan (JDIH BPK, Details/359755, dibaca 12 Nov 2026) ditetapkan, diundangkan,
// dan berlaku 28 Okt 2026, LN 2026 (179), TLN 7222; mencabut UU 13/2003 dan sebagian UU 6/2023. Pasalnya belum dibaca Nadi
// (R-UUPK2 menunggu naskah PDF), jadi hitungan ketenagakerjaan masih memakai aturan sebelumnya dan setiap layar yang menyebut dasar
// itu menampilkan CatatanUuBaru. Setelah pasal dicocokkan dan aturan_bertanggal diperbarui, pasalDicek menjadi true.

export const UU_BARU = {
  nomor: "UU 27/2026",
  berlaku: "2026-10-28",
  sumber: "https://peraturan.bpk.go.id/Details/359755/uu-no-27-tahun-2026-pelindungan-ketenagakerjaan",
  pasalDicek: false,
} as const;

/** Dasar aturan yang terdampak UU 27/2026: UU 13/2003, UU 6/2023 (Cipta Kerja), dan peraturan pelaksananya PP 35/2021 dan PP 36/2021. */
export const DASAR_TERDAMPAK = /\b(?:UU\s*13\/2003|UU\s*6\/2023|PP\s*35\/2021|PP\s*36\/2021|Cipta Kerja)/i;

/** Catatan perlu tampil bila dasar menyebut aturan terdampak, hari (YYYY-MM-DD) sudah masuk masa berlaku UU baru, dan pasal belum dicek. */
export function perluCatatan(dasar: string | null | undefined, hari: string, pasalDicek: boolean = UU_BARU.pasalDicek): boolean {
  return !pasalDicek && hari >= UU_BARU.berlaku && DASAR_TERDAMPAK.test(dasar ?? "");
}
