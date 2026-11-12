// L-08 alat gratis dua bahasa: teks antarmuka kalkulator, pembuat invoice, dan templat dokumen. Angka dan rumus tidak
// berubah (susunSlip, hitungThr, hitungPesangon, totalBaris yang sama); hanya teks yang dipilih menurut bahasa.
import { teksMasaKerja } from "@/lib/gaji/pesangon";
import type { Bahasa } from "@/lib/i18n/bahasa";

export const TEKS_ALAT = {
  id: {
    isianGaji: "Isian gaji", namaUsaha: "Nama usaha", namaKaryawan: "Nama karyawan", pokok: "Gaji pokok sebulan", tunjangan: "Tunjangan tetap sebulan",
    tunjanganKet: "Tunjangan yang dibayar sama setiap bulan, tidak tergantung kehadiran.", ptkp: "Status pajak (PTKP)", ptkpKet: "TK = belum kawin, K = kawin; angka = tanggungan.",
    risiko: "Risiko kerja (BPJS JKK)", lembur: "Lembur di hari kerja (jam)", lemburKet: "Satu hari lembur, paling lama 4 jam. Upah lembur dihitung dari upah sebulan / 173.",
    slip: "Slip gaji", bulanKe: "bulan ke-", gajiBersih: "Gaji bersih yang diterima", pendapatan: "Pendapatan", potongan: "Potongan", dibayarUsaha: "Dibayar usaha di luar gaji", jumlah: "Jumlah",
    biayaUsaha: "Biaya usaha untuk orang ini:", sebulan: "sebulan.", cetak: "Cetak atau simpan PDF",
    risikoPilihan: ["Sangat rendah (kantor, toko)", "Rendah", "Sedang", "Tinggi", "Sangat tinggi"],
    isianThr: "Isian THR", mulai: "Mulai bekerja", hariRaya: "Tanggal Hari Raya", masaThr: "Masa kerja sampai Hari Raya:", belumBerhak: "Belum berhak THR (kurang dari 1 bulan).",
    penuh: "12 bulan atau lebih: 1 bulan upah.", sebagian: (m: number) => `Kurang dari 12 bulan: ${m}/12 x upah sebulan.`, upahSebulan: "Upah sebulan (pokok + tunjangan tetap):", batasBayar: "Dibayar paling lambat",
    isiTanggal: "Isi tanggal mulai dan tanggal Hari Raya.",
    isianPesangon: "Isian pesangon", berhenti: "Tanggal berhenti", kontrak: "Karyawan kontrak (PKWT)", belumDibuka: "Tabel pesangon belum diperiksa ke sumber resmi, jadi kalkulator ini belum dibuka.",
    hasilPesangon: "Pesangon + penghargaan masa kerja (skenario dasar)",
    rincianPesangon: (masa: string, p: number, u: number, upah: string) => `Masa kerja ${masa}. Uang pesangon ${p} bulan upah, uang penghargaan masa kerja ${u} bulan upah, upah sebulan ${upah}.`,
    skenario: (rugi: string, pensiun: string) => `Bila berhenti karena usaha merugi: ${rugi}. Bila pensiun: ${pensiun}. Jumlah sungguhan tergantung alasan berhenti.`,
    hasilKompensasi: "Uang kompensasi kontrak",
    rincianKompensasi: (masa: string, upah: string) => `Masa kerja ${masa} / 12 x upah sebulan ${upah}. Untuk usaha mikro dan kecil besarnya berdasarkan kesepakatan, jadi angka ini acuan.`,
    kontrakBelum: "Aturan kompensasi kontrak belum diperiksa ke sumber resmi.", isiPokok: "Isi gaji pokok.", periksaTanggal: "Periksa tanggal mulai dan tanggal berhenti.",
    alasanBerhenti: "Alasan berhenti", hasilAlasan: "Pesangon, penghargaan masa kerja, dan uang pisah",
    rincianAlasan: (pasal: string, p: string | null, u: string | null, pisah: string | null) => `${pasal} UU 27/2026: ${p ? `uang pesangon ${p}` : "tanpa uang pesangon"}, ${u ? `uang penghargaan masa kerja ${u}` : "tanpa uang penghargaan masa kerja"}${pisah ? `, uang pisah paling sedikit ${pisah} (Pasal 233 ayat (2); bila peraturan perusahaan mengatur lebih besar, pakai yang lebih besar)` : ""}. Ditambah uang penggantian hak: sisa cuti tahunan dan ongkos pulang (Pasal 232 ayat (4)).`,
    mikroKecil: "Usaha mikro dan kecil membayar menurut kesepakatan dengan pekerja (UU 27/2026 Pasal 250); angka ini bisa jadi acuan.",
    alasanPhk: {
      tutup_rugi: "Usaha tutup karena rugi 2 tahun berturut-turut", tutup_permanen: "Pemilik menutup usaha untuk seterusnya", kahar: "Keadaan memaksa (kahar)",
      pkpu_pailit: "Usaha dalam PKPU atau pailit", gabung_pekerja_menolak: "Usaha digabung atau diambil alih, pekerja tidak mau lanjut",
      gabung_tidak_diterima: "Usaha digabung atau diambil alih, pekerja tidak diterima", pemberi_kerja_melanggar: "Pekerja minta berhenti karena pemberi kerja melanggar (mis. upah telat 3 bulan)",
      tuduhan_tidak_terbukti: "Permohonan pekerja itu ditolak lembaga perselisihan, lalu diberhentikan", mundur: "Mengundurkan diri", mangkir: "Mangkir 5 hari kerja berturut-turut",
      pelanggaran: "Pelanggaran setelah SP1, SP2, dan SP3", ditahan_rugi: "Ditahan pihak berwajib 6 bulan dan merugikan usaha", ditahan: "Ditahan pihak berwajib 6 bulan, tidak merugikan usaha",
      sakit_panjang: "Sakit berkepanjangan atau cacat karena kecelakaan kerja lebih dari 12 bulan", pensiun: "Pensiun", meninggal: "Meninggal dunia (dibayar ke ahli waris)",
    } as Record<string, string>,
    isianInvoice: "Isian invoice", alamat: "Alamat dan kontak", ditagihkan: "Ditagihkan kepada", namaPelanggan: "Nama pelanggan", nomor: "Nomor", tanggal: "Tanggal", tempo: "Jatuh tempo",
    barangJasa: "Barang atau jasa", uraian: "Uraian", jml: "Jumlah", harga: "Harga", hapus: "Hapus", hapusBaris: (i: number) => `Hapus baris ${i}`, tambahBaris: "Tambah baris",
    caraBayar: "Cara bayar", caraBayarAwal: "Transfer ke rekening atas nama usaha, atau QRIS.", pratinjauInvoice: "Pratinjau invoice", jatuhTempo: "jatuh tempo", subtotal: "Subtotal", total: "Total",
    kakiInvoice: "Dibuat dengan alat gratis Nadi. Di Nadi, invoice bernomor otomatis, punya tautan untuk pelanggan, QRIS, dan pengingat.", uraianAwal: "Nasi kotak",
    isianDokumen: "Isian dokumen", jenisDokumen: "Jenis dokumen", kota: "Kota", tujuan: "Tujuan atau tempat baru", keperluanIzin: "Jenis izin (sakit, cuti, keperluan keluarga)",
    diserahkan: "Yang diserahkan", keperluanTugas: "Keperluan tugas", pelanggaran: "Pelanggaran", alasan: "Alasan", lama: "Lama (hari)", tingkat: "Tingkat", penerima: "Penerima",
    pratinjauDokumen: "Pratinjau dokumen",
    jenis: { keterangan_kerja: "Surat keterangan kerja", surat_tugas: "Surat tugas", sk_mutasi: "Surat keputusan mutasi", peringatan: "Surat peringatan", izin: "Formulir izin atau cuti", serah: "Berita acara serah terima" },
  },
  en: {
    isianGaji: "Salary inputs", namaUsaha: "Business name", namaKaryawan: "Employee name", pokok: "Monthly base salary", tunjangan: "Monthly fixed allowance",
    tunjanganKet: "An allowance paid the same every month, regardless of attendance.", ptkp: "Tax status (PTKP)", ptkpKet: "TK = single, K = married; the number = dependants.",
    risiko: "Work risk (BPJS JKK)", lembur: "Overtime on a work day (hours)", lemburKet: "One day of overtime, at most 4 hours. Overtime pay uses monthly wage / 173.",
    slip: "Payslip", bulanKe: "month ", gajiBersih: "Take-home pay", pendapatan: "Earnings", potongan: "Deductions", dibayarUsaha: "Paid by the business on top of salary", jumlah: "Total",
    biayaUsaha: "Cost to the business for this person:", sebulan: "a month.", cetak: "Print or save as PDF",
    risikoPilihan: ["Very low (office, shop)", "Low", "Medium", "High", "Very high"],
    isianThr: "THR inputs", mulai: "Start date", hariRaya: "Holiday date (Hari Raya)", masaThr: "Length of service until the holiday:", belumBerhak: "Not yet entitled to THR (less than 1 month).",
    penuh: "12 months or more: 1 month of wages.", sebagian: (m: number) => `Less than 12 months: ${m}/12 x monthly wage.`, upahSebulan: "Monthly wage (base + fixed allowance):", batasBayar: "Pay no later than",
    isiTanggal: "Fill in the start date and the holiday date.",
    isianPesangon: "Severance inputs", berhenti: "Last working date", kontrak: "Fixed-term employee (PKWT)", belumDibuka: "The severance table has not been checked against the official source yet, so this calculator is not open.",
    hasilPesangon: "Severance + long-service pay (base scenario)",
    rincianPesangon: (masa: string, p: number, u: number, upah: string) => `Length of service ${masa}. Severance ${p} months of wages, long-service pay ${u} months of wages, monthly wage ${upah}.`,
    skenario: (rugi: string, pensiun: string) => `If the job ends because the business is losing money: ${rugi}. On retirement: ${pensiun}. The real amount depends on the reason the job ends.`,
    hasilKompensasi: "Fixed-term contract compensation",
    rincianKompensasi: (masa: string, upah: string) => `Length of service ${masa} / 12 x monthly wage ${upah}. For micro and small businesses the amount is agreed between both sides, so treat this as a reference.`,
    kontrakBelum: "The contract compensation rule has not been checked against the official source yet.", isiPokok: "Fill in the base salary.", periksaTanggal: "Check the start date and the last working date.",
    alasanBerhenti: "Reason the job ends", hasilAlasan: "Severance, long-service pay, and separation pay",
    rincianAlasan: (pasal: string, p: string | null, u: string | null, pisah: string | null) => `${pasal.replace("Pasal", "Article").replace("ayat", "paragraph")} of UU 27/2026: ${p ? `severance ${p}` : "no severance"}, ${u ? `long-service pay ${u}` : "no long-service pay"}${pisah ? `, separation pay of at least ${pisah} (Article 233(2); if company regulations set a higher amount, use the higher one)` : ""}. Plus entitlement compensation: unused annual leave and travel home (Article 232(4)).`,
    mikroKecil: "Micro and small businesses pay what they agree with the employee (UU 27/2026 Article 250); use this amount as a reference.",
    alasanPhk: {
      tutup_rugi: "Business closes after 2 years of losses in a row", tutup_permanen: "The owner closes the business for good", kahar: "Force majeure",
      pkpu_pailit: "Business in debt suspension (PKPU) or bankrupt", gabung_pekerja_menolak: "Business merged or taken over, the employee does not continue",
      gabung_tidak_diterima: "Business merged or taken over, the employee is not taken on", pemberi_kerja_melanggar: "Employee asks to leave because the employer breached (e.g. wages 3 months late)",
      tuduhan_tidak_terbukti: "The employee's claim is rejected by the dispute body, then dismissed", mundur: "Resignation", mangkir: "Absent without notice for 5 working days in a row",
      pelanggaran: "Breach after the first, second, and third warning letters", ditahan_rugi: "Detained by the authorities for 6 months, causing the business a loss", ditahan: "Detained by the authorities for 6 months, no loss to the business",
      sakit_panjang: "Long-term illness or disability from a work accident over 12 months", pensiun: "Retirement", meninggal: "Death (paid to the heirs)",
    } as Record<string, string>,
    isianInvoice: "Invoice inputs", alamat: "Address and contact", ditagihkan: "Bill to", namaPelanggan: "Customer name", nomor: "Number", tanggal: "Date", tempo: "Due date",
    barangJasa: "Goods or services", uraian: "Description", jml: "Qty", harga: "Price", hapus: "Remove", hapusBaris: (i: number) => `Remove line ${i}`, tambahBaris: "Add line",
    caraBayar: "How to pay", caraBayarAwal: "Bank transfer to the business account, or QRIS.", pratinjauInvoice: "Invoice preview", jatuhTempo: "due", subtotal: "Subtotal", total: "Total",
    kakiInvoice: "Made with Nadi's free tools. In Nadi, invoices are numbered automatically and come with a customer link, QRIS, and reminders.", uraianAwal: "Boxed rice meal",
    isianDokumen: "Document inputs", jenisDokumen: "Document type", kota: "City", tujuan: "Destination or new place", keperluanIzin: "Leave type (sick, annual leave, family matters)",
    diserahkan: "Items handed over", keperluanTugas: "Purpose of the assignment", pelanggaran: "Violation", alasan: "Reason", lama: "Length (days)", tingkat: "Level", penerima: "Recipient",
    pratinjauDokumen: "Document preview (in Indonesian)",
    jenis: { keterangan_kerja: "Employment certificate", surat_tugas: "Assignment letter", sk_mutasi: "Transfer decree", peringatan: "Warning letter", izin: "Leave request form", serah: "Handover record" },
  },
} as const;

export type TeksAlat = (typeof TEKS_ALAT)["id"] | (typeof TEKS_ALAT)["en"];
export const teksAlat = (b: Bahasa): TeksAlat => TEKS_ALAT[b === "en" ? "en" : "id"];

const KOMPONEN_EN: Record<string, string> = {
  pokok: "Base salary", tunjangan_tetap: "Fixed allowance", insentif_beban: "Workload incentive", komisi: "Sales and service commission",
  pph21: "Income tax (PPh 21)", bpjs_kes: "BPJS Health", jht: "Old-age savings (JHT)", jp: "Pension (JP)",
  bpjs_kes_pk: "BPJS Health (paid by business)", jht_pk: "JHT (paid by business)", jp_pk: "JP (paid by business)", jkk: "Work accident (JKK, paid by business)", jkm: "Death benefit (JKM, paid by business)",
};

/** Label komponen slip: bahasa Indonesia apa adanya dari susunSlip; bahasa Inggris dari kode komponen. */
export function labelKomponen(kode: string, label: string, b: Bahasa): string {
  if (b !== "en") return label;
  if (kode === "lembur") return label.replace(/^Lembur (.+) jam$/, "Overtime $1 h");
  return KOMPONEN_EN[kode] ?? label;
}

const PERINGATAN_EN: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Aturan upah lembur belum diperiksa/, () => "The overtime pay rule has not been checked against the official source yet; overtime is not counted."],
  [/^Lembur (\S+) \((\S+) jam\) melebihi batas UU 27\/2026 Pasal 116/, (m) => `Overtime on ${m[1]} (${m[2]} h) is over the UU 27/2026 Article 116 limit; it is not counted.`],
  [/^Tarif BPJS Kesehatan belum diperiksa/, () => "The BPJS Health rate has not been checked against the official source yet; it is not counted."],
  [/^Sebagian tarif BPJS Ketenagakerjaan belum diperiksa/, () => "Some BPJS Employment rates have not been checked against the official source yet; they are not counted."],
  [/^Batas upah Jaminan Pensiun tahun ini belum terverifikasi/, () => "This year's pension (JP) wage cap is not verified yet; JP is not counted. Add it by hand if your business must join JP."],
  [/^Status PTKP belum diisi/, () => "PTKP status is empty (e.g. TK/0 or K/1); income tax is not calculated."],
  [/^Tabel PPh 21 belum diperiksa/, () => "The income tax (PPh 21) table has not been checked against the official source yet; it is not calculated."],
  [/^Riwayat gaji Januari sampai November tidak lengkap/, () => "January to November pay history is incomplete; December income tax uses TER and is not annualised."],
];

/** Peringatan dari susunSlip dalam bahasa yang dipilih; pesan yang belum dikenal tetap ditampilkan apa adanya. */
export function teksPeringatan(p: string, b: Bahasa): string {
  if (b !== "en") return p;
  for (const [pola, ganti] of PERINGATAN_EN) {
    const m = p.match(pola);
    if (m) return ganti(m);
  }
  return p;
}

/** Masa kerja dalam tahun dan bulan (bahasa Indonesia memakai teksMasaKerja aplikasi apa adanya). */
export function masaKerjaTeks(bulan: number, b: Bahasa): string {
  if (b !== "en") return teksMasaKerja(bulan);
  const t = Math.floor(bulan / 12);
  const s = bulan % 12;
  if (!t && !s) return "less than 1 month";
  return [t ? `${t} ${t === 1 ? "year" : "years"}` : "", s ? `${s} ${s === 1 ? "month" : "months"}` : ""].filter(Boolean).join(" ");
}
