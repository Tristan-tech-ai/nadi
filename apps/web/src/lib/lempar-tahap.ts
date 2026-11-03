// Tahap satu berkas di Lempar Saja (D-13). "luring" = sinyal hilang, berkas ditahan di halaman dan dikirim lagi saat online.
export type TahapLempar = "siap" | "unggah" | "baca" | "selesai" | "luring";

export function tahapLempar(t: TahapLempar): { tertahan: boolean; berjalan: boolean } {
  return { tertahan: t === "luring", berjalan: t === "siap" || t === "unggah" || t === "baca" };
}
