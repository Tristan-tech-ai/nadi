import type { JenisHariLembur } from "./bpjs-lembur";

/** Label jenis hari lembur (PP 35/2021 Pasal 31) untuk isian dan daftar. */
export const JENIS_LEMBUR: Record<JenisHariLembur, string> = {
  hari_kerja: "Hari kerja",
  libur_pola_6_hari: "Hari libur (kerja 6 hari seminggu)",
  libur_pola_6_hari_jatuh_hari_kerja_terpendek: "Libur di hari kerja terpendek (kerja 6 hari)",
  libur_pola_5_hari: "Hari libur (kerja 5 hari seminggu)",
};
