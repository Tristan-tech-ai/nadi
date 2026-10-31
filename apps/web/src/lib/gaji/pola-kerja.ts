import type { JenisHariLembur } from "./bpjs-lembur";

/**
 * Pola kerja usaha (Q-22, docs/research/pola-kerja.md): satu sumber di perusahaan.pengaturan.pola_kerja, dibaca database lewat
 * app.pola_kerja(pid). Angka dari PP 35/2021 Pasal 21 ayat (2) (7 jam x 6 hari atau 8 jam x 5 hari, 40 jam seminggu), Pasal 22
 * (libur mingguan 1 atau 2 hari), dan pembagi upah sehari PP 36/2021 Pasal 17 (docs/research/upah-harian.md).
 */
export type PolaKerja = "6_hari" | "5_hari";

export const POLA_BAWAAN: PolaKerja = "6_hari";

export const POLA_KERJA: Record<PolaKerja, { hari: number; judul: string; keterangan: string }> = {
  "6_hari": { hari: 6, judul: "6 hari seminggu, 7 jam sehari", keterangan: "Libur 1 hari seminggu. Upah sehari = upah sebulan dibagi 25." },
  "5_hari": { hari: 5, judul: "5 hari seminggu, 8 jam sehari", keterangan: "Libur 2 hari seminggu. Upah sehari = upah sebulan dibagi 21." },
};

export const polaSah = (x: unknown): x is PolaKerja => x === "6_hari" || x === "5_hari";

/** Sama dengan pemeriksaan di catat_lembur: hari kerja selalu boleh, jenis libur harus sesuai pola usaha. */
export function jenisCocokPola(pola: PolaKerja, jenis: JenisHariLembur): boolean {
  if (jenis === "hari_kerja") return true;
  return (pola === "5_hari") === (jenis === "libur_pola_5_hari");
}

/** Lembar dampak muncul hanya bila pola berubah dan usaha sudah punya data yang terkena (lembur libur atau slip). */
export function perluLembarDampak(lama: PolaKerja, baru: PolaKerja, data: { lemburLibur: number; slip: number }): boolean {
  return lama !== baru && (data.lemburLibur > 0 || data.slip > 0);
}

/** Kalimat lembar dampak dengan jumlah lembur libur yang nyata (dari database), bukan kalimat umum. */
export function kalimatDampak(baru: PolaKerja, lemburLibur: number): string[] {
  return [
    lemburLibur > 0
      ? `Lembur hari libur yang sudah tercatat (${lemburLibur} baris) tidak berubah.`
      : "Belum ada lembur hari libur yang tercatat.",
    `Mulai sekarang, lembur hari libur dicatat dengan aturan pola ${POLA_KERJA[baru].hari} hari.`,
    "Slip yang sudah disetujui tidak berubah. Slip draf bulan ini dihitung ulang saat kamu menyiapkannya lagi.",
  ];
}

export const pesanTersimpan = (pola: PolaKerja) => `Tersimpan. Usahamu bekerja ${POLA_KERJA[pola].hari} hari seminggu.`;
