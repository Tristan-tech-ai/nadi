// Kompas Pajak (F4-07, docs/research/kompas-pajak.md). Hitungan PPh final UMKM menurut PP 55/2022 sebagaimana diubah PP 20/2026
// (LN 2026 No. 43, berlaku 22 Apr 2026), angka dari aturan_bertanggal kunci pph.final_umkm. Hanya hitungan yang sah: Nadi
// tidak pernah menyarankan memecah usaha, memakai nama orang lain, atau menunda pencatatan supaya di bawah batas.
import { formatRupiah } from "@/lib/format";
import { persenDari, pph17, ptkpSetahun, type LapisanP17, type Ptkp } from "@/lib/gaji/pph21";

export type AturanFinal = { tarif_persen: number; batas_bruto: number; bebas_op: number; koperasi_tahun: number };
export type Bentuk = "op" | "pt_perorangan" | "koperasi" | "badan_lain";

export const NAMA_BENTUK: Record<Bentuk, string> = {
  op: "Orang pribadi (usaha atas nama sendiri)",
  pt_perorangan: "Perseroan perorangan (PT satu orang)",
  koperasi: "Koperasi",
  badan_lain: "CV, firma, PT biasa, atau BUMDes",
};

export const DASAR = {
  tarif: "PP 55/2022 Pasal 56 ayat (2) sebagaimana diubah PP 20/2026, berlaku 22 Apr 2026",
  bebas: "PP 55/2022 Pasal 60 ayat (2) dan (3) (orang pribadi; tidak diubah PP 20/2026)",
  subjek: "PP 55/2022 Pasal 57 ayat (1) sebagaimana diubah PP 20/2026, berlaku 22 Apr 2026",
  gabungan: "PP 55/2022 Pasal 57 ayat (2) huruf e dan ayat (4), Pasal 58 sebagaimana diubah PP 20/2026, berlaku 22 Apr 2026",
  lewat: "PP 55/2022 Pasal 61 (tetap final sampai akhir tahun pajak, tahun berikutnya tarif umum)",
  peralihan: "PP 20/2026 Pasal II angka 1 huruf e (CV, firma, PT biasa, BUMDes memakai sisa jangka waktu lama) dan Pasal 57 ayat (1)",
  pasal17: "UU PPh Pasal 17 ayat (1) huruf a dan Pasal 7 sebagaimana diubah UU 7/2021",
} as const;

export type BulanFinal = { bulan: number; bruto: number; kumulatif: number; dpp: number; pajak: number };

/** PPh final per bulan dari bruto bulanan (Jan..Des). Orang pribadi: bagian kumulatif sampai Rp500 jt setahun tidak dikenai. */
export function hitungFinal(bulanan: readonly number[], bentuk: Bentuk, a: AturanFinal): { perBulan: BulanFinal[]; total: number; lewatBulan: number | null; berlaku: boolean } {
  if (bentuk === "badan_lain") return { perBulan: [], total: 0, lewatBulan: null, berlaku: false };
  let kum = 0;
  let lewatBulan: number | null = null;
  const perBulan = bulanan.map((bruto, i) => {
    const sebelum = kum;
    kum += Math.max(0, bruto);
    const dpp = bentuk === "op" ? Math.max(0, kum - a.bebas_op) - Math.max(0, sebelum - a.bebas_op) : Math.max(0, bruto);
    if (lewatBulan === null && kum > a.batas_bruto) lewatBulan = i + 1;
    return { bulan: i + 1, bruto: Math.max(0, bruto), kumulatif: kum, dpp, pajak: persenDari(dpp, a.tarif_persen) };
  });
  return { perBulan, total: perBulan.reduce((t, b) => t + b.pajak, 0), lewatBulan, berlaku: true };
}

export type IsianBatas = { bentuk: Bentuk; brutoLalu: number; usahaLainLalu: number; pasanganLalu: number; brutoIni: number; usahaLainIni: number; pasanganIni: number };
export type HasilBatas = { status: "boleh" | "lewat_tahun_lalu" | "lewat_tahun_ini" | "tidak_berlaku"; gabunganLalu: number; gabunganIni: number; kalimat: string; dasar: string };

/** Batas Rp4,8 M dihitung dari gabungan usaha pemilik (dan PT perorangan miliknya, serta pasangan pisah harta). */
export function cekBatas(x: IsianBatas, a: AturanFinal): HasilBatas {
  const gabunganLalu = x.brutoLalu + x.usahaLainLalu + x.pasanganLalu;
  const gabunganIni = x.brutoIni + x.usahaLainIni + x.pasanganIni;
  const batas = formatRupiah(a.batas_bruto);
  if (x.bentuk === "badan_lain") {
    return { status: "tidak_berlaku", gabunganLalu, gabunganIni, dasar: DASAR.peralihan,
      kalimat: `Sejak 22 Apr 2026 tarif final 0,5% hanya untuk orang pribadi, perseroan perorangan, dan koperasi. CV, firma, dan PT biasa memakai tarif umum, kecuali sisa jangka waktu lamanya belum habis. Tanyakan sisa jangka waktu itu ke akuntanmu.` };
  }
  if (gabunganLalu > a.batas_bruto) {
    return { status: "lewat_tahun_lalu", gabunganLalu, gabunganIni, dasar: DASAR.gabungan,
      kalimat: `Gabungan peredaran bruto tahun lalu ${formatRupiah(gabunganLalu)}, di atas ${batas}. Tahun ini dan seterusnya memakai tarif umum, bukan final 0,5%.` };
  }
  if (gabunganIni > a.batas_bruto) {
    return { status: "lewat_tahun_ini", gabunganLalu, gabunganIni, dasar: `${DASAR.gabungan}; ${DASAR.lewat}`,
      kalimat: `Gabungan tahun ini sudah ${formatRupiah(gabunganIni)}, di atas ${batas}. Sampai akhir tahun ini tetap final 0,5%; mulai tahun depan tarif umum. Siapkan pembukuan lengkap sekarang.` };
  }
  return { status: "boleh", gabunganLalu, gabunganIni, dasar: DASAR.gabungan,
    kalimat: `Gabungan tahun ini ${formatRupiah(gabunganIni)}. Masih ${formatRupiah(a.batas_bruto - gabunganIni)} sebelum ${batas}.` };
}

export type BarisSimulasi = { bentuk: string; pajak: number; dasar: string; catatan: string };

/** Perbandingan sah setahun untuk perkiraan bruto dan laba. Badan tarif umum tidak dihitung sampai sumbernya diverifikasi. */
export function simulasi(x: { bruto: number; laba: number; statusPtkp: string }, a: AturanFinal, lapisan: LapisanP17, ptkp: Ptkp) {
  const finalOp = hitungFinal([x.bruto], "op", a).total;
  const finalPt = hitungFinal([x.bruto], "pt_perorangan", a).total;
  const pkp = Math.max(0, x.laba - ptkpSetahun(x.statusPtkp, ptkp));
  const baris: BarisSimulasi[] = [
    { bentuk: "Orang pribadi, PPh final 0,5%", pajak: finalOp, dasar: `${DASAR.tarif}; ${DASAR.bebas}`,
      catatan: "Dari peredaran bruto, laba atau rugi tidak dihitung. Rp500 jt pertama setahun tidak dikenai." },
    { bentuk: "Perseroan perorangan, PPh final 0,5%", pajak: finalPt, dasar: `${DASAR.tarif}; ${DASAR.subjek}`,
      catatan: "Dari peredaran bruto tanpa bagian bebas. Harta usaha terpisah dari harta pribadi." },
    { bentuk: "Orang pribadi, tarif umum Pasal 17 (dari laba)", pajak: pph17(pkp, lapisan), dasar: DASAR.pasal17,
      catatan: `Dari laba setelah PTKP ${x.statusPtkp}. Butuh pembukuan; boleh dipilih bila laba tipis, dengan pemberitahuan ke DJP (Pasal 57 ayat (3)).` },
  ];
  if (x.bruto > a.batas_bruto) baris.splice(0, 2);
  return {
    baris,
    tidakDihitung: "Badan biasa (CV, PT) dengan tarif Pasal 17 ayat (1) huruf b dan fasilitas Pasal 31E UU PPh belum dihitung karena Nadi belum mencocokkan angkanya ke teks resmi.",
    peringatan: "Batas Rp4,8 M dihitung gabungan semua usaha pemilik, PT perorangan yang ia dirikan, dan pasangan yang pisah harta. Memecah usaha atau memakai nama orang lain tidak membuat batas itu terlewati dan bisa melanggar hukum.",
  };
}
