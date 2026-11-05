// Penyusun slip gaji: aturan bertanggal + data gaji satu orang -> komponen slip dan peringatan. Murni (tanpa jaringan).
// Aturan yang belum terverifikasi tidak dipakai: komponennya tidak dihitung dan slip memberi peringatan (docs/research/slip-gaji.md).
import { iuranBpjs, upahLembur, type AturanLembur, type JenisHariLembur, type TarifBpjs } from "./bpjs-lembur";
import { pph21Bulanan, pph21MasaTerakhir, type LapisanP17, type Ptkp, type TabelTer } from "./pph21";

export type Aturan = { nilai: unknown; terverifikasi: boolean };
export type PetaAturan = Record<string, Aturan | undefined>;
export type Komponen = { kode: string; label: string; jenis: "pendapatan" | "potongan" | "pemberi_kerja"; nilai: number; sumber: string };
export type RisikoJkk = "sangat_rendah" | "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
export type DataGaji = { pokok: number; tunjangan_tetap?: number; ptkp?: string; risiko_jkk?: RisikoJkk };
/** Akumulasi Januari s.d. bulan sebelumnya di tahun yang sama (untuk masa Desember). */
export type Riwayat = { brutoPph: number; pphDipotong: number; iuranPegawai: number; bulan: number };
/** Satu hari lembur yang dicatat pengelola (tabel lembur). */
export type LemburHari = { tanggal: string; jenis: JenisHariLembur; jam: number };

/** Kode komponen pemberi kerja yang masuk penghasilan bruto PPh 21 (PMK 168/2023 Pasal 6 ayat (3)). */
export const MASUK_BRUTO_PPH = ["jkk", "jkm", "bpjs_kes_pk"];
/** Iuran pegawai yang mengurangi neto setahun (PMK 168/2023 Pasal 10 ayat (1)). */
export const IURAN_PEGAWAI = ["jht", "jp"];

const pakai = <T>(a: PetaAturan, kunci: string): T | null => (a[kunci]?.terverifikasi ? (a[kunci]!.nilai as T) : null);

/**
 * insentif: bagian kolam insentif beban kerja yang disetujui untuk bulan ini (F3-05, public.kolam_bagian). Pendapatan non-upah
 * (PP 36/2021 Pasal 8 ayat (2) dan Pasal 10): masuk bruto PPh 21, tidak menambah `upah` (dasar BPJS dan lembur). komisi: sama, dari aturan komisi.
 */
export function susunSlip(g: DataGaji, aturan: PetaAturan, bulan: number, riwayat?: Riwayat, lembur: LemburHari[] = [], insentif = 0, komisi = 0): { komponen: Komponen[]; peringatan: string[] } {
  const komponen: Komponen[] = [];
  const peringatan: string[] = [];
  const tambah = (k: Komponen) => {
    if (k.nilai > 0 || k.kode === "pph21") komponen.push(k);
  };
  tambah({ kode: "pokok", label: "Gaji pokok", jenis: "pendapatan", nilai: g.pokok, sumber: "orang_rahasia" });
  tambah({ kode: "tunjangan_tetap", label: "Tunjangan tetap", jenis: "pendapatan", nilai: g.tunjangan_tetap ?? 0, sumber: "orang_rahasia" });
  const upah = g.pokok + (g.tunjangan_tetap ?? 0);

  // Lembur (PP 35/2021 Pasal 31-32): dasar upah sebulan = pokok + tunjangan tetap (Nadi belum mencatat tunjangan tidak tetap,
  // jadi aturan 75% Pasal 32 ayat (4) tidak berlaku). Pendapatan, sehingga masuk bruto PPh 21.
  const hariLembur = lembur.filter((l) => l.jam > 0);
  if (hariLembur.length) {
    const al = pakai<AturanLembur>(aturan, "lembur.pp35");
    if (!al) {
      peringatan.push("Aturan upah lembur belum diperiksa ke sumber resmi; lembur belum dihitung.");
    } else {
      let nilai = 0;
      let jam = 0;
      for (const l of hariLembur) {
        try {
          nilai += upahLembur(upah, l.jenis, l.jam, al).upah;
          jam += l.jam;
        } catch {
          peringatan.push(`Lembur ${l.tanggal} (${l.jam} jam) melebihi batas PP 35/2021; tidak dihitung.`);
        }
      }
      tambah({ kode: "lembur", label: `Lembur ${jam} jam`, jenis: "pendapatan", nilai, sumber: "aturan:lembur.pp35" });
    }
  }

  if (Number.isInteger(insentif) && insentif > 0) {
    tambah({ kode: "insentif_beban", label: "Insentif beban kerja", jenis: "pendapatan", nilai: insentif, sumber: "PP 36/2021 Pasal 8 dan 10" });
  }
  // W-07C: komisi penjualan/layanan bulan ini (public.commission_summary). Seperti insentif: masuk bruto PPh 21, tidak menambah `upah`
  // (dasar BPJS dan lembur); perlakuan dasar BPJS untuk komisi belum diverifikasi ke aturan BPJS.
  if (Number.isInteger(komisi) && komisi > 0) {
    tambah({ kode: "komisi", label: "Komisi penjualan dan layanan", jenis: "pendapatan", nilai: komisi, sumber: "aturan komisi usaha" });
  }

  // BPJS: masing-masing program hanya dihitung bila aturannya terverifikasi.
  const kes = pakai<{ pemberi_kerja: number; pekerja: number; batas_upah: number }>(aturan, "bpjs.kesehatan");
  const jht = pakai<{ pemberi_kerja: number; pekerja: number }>(aturan, "bpjs.jht");
  const jkm = pakai<number>(aturan, "bpjs.jkm.pemberi_kerja");
  const jkk = pakai<Record<string, number>>(aturan, "bpjs.jkk.pemberi_kerja");
  const jp = pakai<{ pemberi_kerja: number; pekerja: number; batas_upah: number | null }>(aturan, "bpjs.jp");
  const persen = (x: number) => x * 100;
  const tarif: TarifBpjs = {
    kesehatan: { pemberi_kerja_persen: persen(kes?.pemberi_kerja ?? 0), pekerja_persen: persen(kes?.pekerja ?? 0), batas_atas_upah: kes?.batas_upah ?? 0 },
    jht: { pemberi_kerja_persen: persen(jht?.pemberi_kerja ?? 0), pekerja_persen: persen(jht?.pekerja ?? 0) },
    jkm_persen: persen(jkm ?? 0),
    jkk_persen: persen(jkk?.[g.risiko_jkk ?? "sangat_rendah"] ?? 0),
    jp: { pemberi_kerja_persen: persen(jp?.pemberi_kerja ?? 0), pekerja_persen: persen(jp?.pekerja ?? 0), batas_upah: jp?.batas_upah ?? null },
  };
  const i = iuranBpjs(upah, tarif);
  if (!kes) peringatan.push("Tarif BPJS Kesehatan belum diperiksa ke sumber resmi; iurannya belum dihitung.");
  if (!jht || !jkm || !jkk) peringatan.push("Sebagian tarif BPJS Ketenagakerjaan belum diperiksa ke sumber resmi; iurannya belum dihitung.");
  if (!jp || !i.jp) peringatan.push("Batas upah Jaminan Pensiun tahun ini belum terverifikasi; iuran JP belum dihitung. Isi manual bila usahamu wajib ikut JP.");
  tambah({ kode: "bpjs_kes_pk", label: "BPJS Kesehatan (ditanggung usaha)", jenis: "pemberi_kerja", nilai: i.kesehatan.pemberiKerja, sumber: "aturan:bpjs.kesehatan" });
  tambah({ kode: "jkk", label: "JKK (ditanggung usaha)", jenis: "pemberi_kerja", nilai: i.jkk.pemberiKerja, sumber: "aturan:bpjs.jkk.pemberi_kerja" });
  tambah({ kode: "jkm", label: "JKM (ditanggung usaha)", jenis: "pemberi_kerja", nilai: i.jkm.pemberiKerja, sumber: "aturan:bpjs.jkm.pemberi_kerja" });
  tambah({ kode: "jht_pk", label: "JHT (ditanggung usaha)", jenis: "pemberi_kerja", nilai: i.jht.pemberiKerja, sumber: "aturan:bpjs.jht" });
  if (i.jp) tambah({ kode: "jp_pk", label: "JP (ditanggung usaha)", jenis: "pemberi_kerja", nilai: i.jp.pemberiKerja, sumber: "aturan:bpjs.jp" });
  tambah({ kode: "bpjs_kes", label: "BPJS Kesehatan", jenis: "potongan", nilai: i.kesehatan.pekerja, sumber: "aturan:bpjs.kesehatan" });
  tambah({ kode: "jht", label: "JHT", jenis: "potongan", nilai: i.jht.pekerja, sumber: "aturan:bpjs.jht" });
  if (i.jp) tambah({ kode: "jp", label: "JP", jenis: "potongan", nilai: i.jp.pekerja, sumber: "aturan:bpjs.jp" });

  // PPh 21.
  const ter = pakai<TabelTer>(aturan, "pph21.ter");
  const peta = pakai<Record<string, string>>(aturan, "pph21.kategori");
  const ptkp = pakai<Ptkp>(aturan, "pph21.ptkp");
  const p17 = pakai<LapisanP17>(aturan, "pph21.pasal17");
  const brutoPph = komponen.filter((k) => k.jenis === "pendapatan" || MASUK_BRUTO_PPH.includes(k.kode)).reduce((s, k) => s + k.nilai, 0);
  let pph = 0;
  let sumber = "aturan:pph21.ter";
  if (!g.ptkp || !peta?.[g.ptkp]) {
    peringatan.push("Status PTKP belum diisi (mis. TK/0 atau K/1); PPh 21 belum dihitung.");
  } else if (!ter || !peta || !ptkp || !p17) {
    peringatan.push("Tabel PPh 21 belum diperiksa ke sumber resmi; PPh 21 belum dihitung.");
  } else if (bulan === 12 && riwayat) {
    const iuranIni = komponen.filter((k) => IURAN_PEGAWAI.includes(k.kode)).reduce((s, k) => s + k.nilai, 0);
    pph = Math.max(
      0,
      pph21MasaTerakhir(
        { status: g.ptkp, brutoSetahun: riwayat.brutoPph + brutoPph, bulan: riwayat.bulan + 1, iuranPegawai: riwayat.iuranPegawai + iuranIni, sudahDipotong: riwayat.pphDipotong },
        { ptkp, pasal17: p17 },
      ).pphMasaTerakhir,
    );
    sumber = "aturan:pph21.pasal17";
  } else {
    if (bulan === 12) peringatan.push("Riwayat gaji Januari sampai November tidak lengkap; PPh 21 Desember dihitung dengan TER, belum disetahunkan.");
    pph = pph21Bulanan(brutoPph, g.ptkp, ter, peta).pph;
  }
  tambah({ kode: "pph21", label: "PPh 21", jenis: "potongan", nilai: pph, sumber });
  return { komponen, peringatan };
}

/** Bruto PPh dan iuran pegawai dari komponen slip tersimpan (untuk riwayat masa Desember). */
export function ringkasKomponen(k: Komponen[]) {
  return {
    // Penggantian biaya (klaim berstruk, M-18) bukan upah: tidak ikut bruto PPh 21 tahunan.
    brutoPph: k.filter((x) => (x.jenis === "pendapatan" && x.kode !== "penggantian") || MASUK_BRUTO_PPH.includes(x.kode)).reduce((s, x) => s + x.nilai, 0),
    pph: k.filter((x) => x.kode === "pph21").reduce((s, x) => s + x.nilai, 0),
    iuranPegawai: k.filter((x) => IURAN_PEGAWAI.includes(x.kode)).reduce((s, x) => s + x.nilai, 0),
  };
}
