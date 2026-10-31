// Iuran BPJS dan upah lembur (docs/research/gaji.md). Persen dan batas upah datang dari aturan bertanggal. Batas yang belum
// terverifikasi dikirim sebagai null dan pemanggil wajib menampilkan peringatan, bukan menebak angka.
import { persenDari } from "./pph21";

export type TarifBpjs = {
  kesehatan: { pemberi_kerja_persen: number; pekerja_persen: number; batas_atas_upah: number };
  jht: { pemberi_kerja_persen: number; pekerja_persen: number };
  jkm_persen: number;
  jkk_persen: number;
  jp: { pemberi_kerja_persen: number; pekerja_persen: number; batas_upah: number | null };
};

export type Iuran = { pekerja: number; pemberiKerja: number };

/** Iuran bulanan dari upah (pokok + tunjangan tetap). JP tanpa batas upah terverifikasi tidak dihitung (null). */
export function iuranBpjs(upah: number, t: TarifBpjs) {
  const dasarKes = Math.min(upah, t.kesehatan.batas_atas_upah);
  const kesehatan: Iuran = { pemberiKerja: persenDari(dasarKes, t.kesehatan.pemberi_kerja_persen), pekerja: persenDari(dasarKes, t.kesehatan.pekerja_persen) };
  const jht: Iuran = { pemberiKerja: persenDari(upah, t.jht.pemberi_kerja_persen), pekerja: persenDari(upah, t.jht.pekerja_persen) };
  const jkm: Iuran = { pemberiKerja: persenDari(upah, t.jkm_persen), pekerja: 0 };
  const jkk: Iuran = { pemberiKerja: persenDari(upah, t.jkk_persen), pekerja: 0 };
  let jp: Iuran | null = null;
  if (t.jp.batas_upah !== null) {
    const dasarJp = Math.min(upah, t.jp.batas_upah);
    jp = { pemberiKerja: persenDari(dasarJp, t.jp.pemberi_kerja_persen), pekerja: persenDari(dasarJp, t.jp.pekerja_persen) };
  }
  return { kesehatan, jht, jkm, jkk, jp };
}

/** Baris pengali lembur: [jam ke dari, jam ke sampai atau null, pengali upah sejam] (PP 35/2021 Pasal 31). */
export type BarisLembur = [number, number | null, number][];
export type AturanLembur = {
  upah_sejam_pembagi: number;
  hari_kerja: BarisLembur;
  libur_pola_6_hari: BarisLembur;
  libur_pola_6_hari_jatuh_hari_kerja_terpendek: BarisLembur;
  libur_pola_5_hari: BarisLembur;
};
export type JenisHariLembur = "hari_kerja" | "libur_pola_6_hari" | "libur_pola_6_hari_jatuh_hari_kerja_terpendek" | "libur_pola_5_hari";

/** Upah lembur satu hari. Jam di luar tabel (melebihi batas) ditolak. Pembulatan ke rupiah terdekat adalah asumsi (tidak diatur PP). */
export function upahLembur(upahSebulan: number, jenis: JenisHariLembur, jam: number, a: AturanLembur) {
  const sejam = upahSebulan / a.upah_sejam_pembagi;
  let kali = 0;
  for (let j = 1; j <= jam; j++) {
    const baris = a[jenis].find(([dari, sampai]) => j >= dari && (sampai === null || j <= sampai));
    if (!baris) throw new Error(`Jam lembur ke-${j} melebihi batas untuk ${jenis}`);
    kali += baris[2];
  }
  return { upahSejam: Math.round(sejam), pengaliTotal: kali, upah: Math.round(sejam * kali) };
}
