// U-10: setiap usulan menyebut apa yang terjadi bila disetujui dan di mana hasilnya terlihat. Isi diturunkan dari pemicu database
// dan public.putuskan_usulan yang dibaca 6 Nov 2026 (bukan tebakan): aksi tanpa pemicu khusus hanya dicatat sebagai kejadian
// beserta berkasnya, dan kalimatnya berkata begitu. Tes tujuan-usulan.test.ts menolak aksi yang dikenal tanpa keterangan.
import type { Bahasa } from "@/lib/i18n/bahasa";

export type Tujuan = { akibat: string; href: string; tempat: string };
type T2 = { id: string; en: string };
type Isi = { akibat: T2; href: string; tempat: T2 };

const t = (id: string, en: string): T2 => ({ id, en });
const TEMPAT = {
  orang: t("Orang", "People"), rekrut: t("Rekrutmen", "Recruitment"), izin: t("Izin dan cuti", "Leave"), gaji: t("Gaji", "Payroll"),
  jadwal: t("Jadwal", "Schedule"), kerja: t("Kerja hari ini", "Today's work"), klaim: t("Klaim pengeluaran", "Expense claims"),
  beli: t("Pembelian", "Purchases"), kas: t("Kas dan bank", "Cash and bank"), buku: t("Laporan keuangan", "Financial reports"),
  impor: t("Impor", "Imports"), thr: t("THR", "Holiday allowance"), serah: t("Serah terima", "Handover"), jual: t("Penjualan", "Sales"),
  barang: t("Barang dan stok", "Products and stock"), pelanggan: t("Pelanggan dan deal", "Customers and deals"), surat: t("Surat masuk", "Incoming letters"),
  lempar: t("Lempar berkas", "Drop files"), usaha: t("Usahamu", "Your business"), kepatuhan: t("Kalender kepatuhan", "Compliance calendar"),
  alur: t("Alur otomatis", "Automations"),
};
const CATAT = t("Dicatat beserta berkasnya sebagai bukti. Tidak ada data lain yang berubah.", "Recorded with its file as evidence. No other data changes.");
const INFO = t("Hanya menandai sudah ditangani. Tidak ada data yang berubah.", "Only marks it as handled. No data changes.");

const PETA: Record<string, Isi> = {
  "orang.buat": { akibat: t("Orang baru masuk daftar Orang, topinya dipasang dari jabatannya.", "A new person joins People, with hats from their job title."), href: "/app/orang", tempat: TEMPAT.orang },
  "orang.impor": { akibat: t("Orang dari berkas masuk daftar Orang; nama yang sudah ada tidak digandakan.", "People from the file join People; existing names are not duplicated."), href: "/app/orang", tempat: TEMPAT.orang },
  "orang.topi": { akibat: t("Topi (peran kerja) orang ini diganti.", "This person's hat (work role) changes."), href: "/app/orang", tempat: TEMPAT.orang },
  "rekrut.pelamar": { akibat: t("Pelamar masuk daftar pelamar di Rekrutmen.", "The applicant joins the list in Recruitment."), href: "/app/rekrutmen", tempat: TEMPAT.rekrut },
  "absen.impor": { akibat: t("Catatan absen dari berkas masuk ke kehadiran orangnya.", "Attendance from the file is added to each person's record."), href: "/app/orang", tempat: TEMPAT.orang },
  "izin.sakit": { akibat: t("Izin sakit dicatat untuk orangnya.", "The sick leave is recorded for the person."), href: "/app/izin", tempat: TEMPAT.izin },
  "izin.setujui": { akibat: t("Izin disetujui dan tercatat.", "The leave is approved and recorded."), href: "/app/izin", tempat: TEMPAT.izin },
  "lembur.ajukan": { akibat: t("Lembur dicatat dan ikut dihitung di slip gaji bulan ini.", "Overtime is recorded and counted in this month's payslip."), href: "/app/gaji", tempat: TEMPAT.gaji },
  "shift.tukar": { akibat: t("Jadwal kedua orang ditukar.", "The two people's shifts are swapped."), href: "/app/jadwal", tempat: TEMPAT.jadwal },
  "kpi.banding": { akibat: t("Nilai KPI orang itu dikoreksi sesuai bandingnya.", "The KPI score is corrected as appealed."), href: "/app/kerja", tempat: TEMPAT.kerja },
  "klaim.setujui": { akibat: t("Klaim disetujui dan menjadi utang ke karyawan, dibayar lewat slip atau kas.", "The claim becomes owed to the employee, paid via payslip or cash."), href: "/app/klaim", tempat: TEMPAT.klaim },
  "dinas.setujui": { akibat: t("Perjalanan dinas disetujui; uang harian dibuat sebagai klaim.", "The business trip is approved; daily allowance becomes a claim."), href: "/app/klaim", tempat: TEMPAT.klaim },
  "uang.keluar": { akibat: t("Masuk Pembelian sebagai tagihan pemasok (utang) dan dicatat di laporan keuangan.", "Goes to Purchases as a supplier bill (payable) and into the financial reports."), href: "/app/beli", tempat: TEMPAT.beli },
  "uang.tagihan": { akibat: t("Masuk Pembelian sebagai tagihan pemasok (utang) dan dicatat di laporan keuangan.", "Goes to Purchases as a supplier bill (payable) and into the financial reports."), href: "/app/beli", tempat: TEMPAT.beli },
  "uang.mutasi": { akibat: t("Baris mutasi rekening masuk Kas dan bank untuk dicocokkan.", "Bank statement lines go to Cash and bank for matching."), href: "/app/kas", tempat: TEMPAT.kas },
  "uang.mutasi_pintu": { akibat: t("Baris mutasi rekening masuk Kas dan bank untuk dicocokkan.", "Bank statement lines go to Cash and bank for matching."), href: "/app/kas", tempat: TEMPAT.kas },
  "uang.penjualan": { akibat: t("Penjualan dicatat ke kas atau bank dan pendapatan.", "Sales are recorded to cash or bank and revenue."), href: "/app/buku", tempat: TEMPAT.buku },
  "uang.impor": { akibat: t("Biaya impor dicatat ke persediaan.", "Import costs are recorded to inventory."), href: "/app/impor", tempat: TEMPAT.impor },
  "uang.thr": { akibat: t("Dicatat sebagai keputusan bayar THR. Nadi tidak memindahkan uang; bayar dari rekeningmu.", "Recorded as the decision to pay. Nadi does not move money; pay from your account."), href: "/app/gaji/thr", tempat: TEMPAT.thr },
  "uang.hak_berhenti": { akibat: t("Dicatat sebagai keputusan bayar hak karyawan yang berhenti. Nadi tidak memindahkan uang.", "Recorded as the decision to pay the leaver. Nadi does not move money."), href: "/app/serah-terima", tempat: TEMPAT.serah },
  "jual.pesanan": { akibat: t("Pesanan penjualan dibuat dan siap dijadikan surat jalan atau invoice.", "A sales order is created, ready for a delivery note or invoice."), href: "/app/jual", tempat: TEMPAT.jual },
  "produk.impor": { akibat: t("Produk dari berkas masuk Barang dan stok.", "Products from the file join Products and stock."), href: "/app/barang", tempat: TEMPAT.barang },
  "stok.opname": { akibat: t("Jumlah stok disesuaikan dengan hasil hitung.", "Stock quantities are adjusted to the count."), href: "/app/barang", tempat: TEMPAT.barang },
  "pindah.akun": { akibat: t("Akun dan saldo awal dari aplikasi lama masuk laporan keuangan; yang sudah ada dilewati.", "Accounts and opening balances join the reports; existing ones are skipped."), href: "/app/buku", tempat: TEMPAT.buku },
  "pindah.kontak": { akibat: t("Pelanggan dari aplikasi lama masuk daftar pelanggan; yang sudah ada dilewati.", "Customers from the old app are added; existing ones are skipped."), href: "/app/pelanggan", tempat: TEMPAT.pelanggan },
  "pindah.produk": { akibat: t("Produk dari aplikasi lama masuk Barang dan stok; yang sudah ada dilewati.", "Products from the old app are added; existing ones are skipped."), href: "/app/barang", tempat: TEMPAT.barang },
  "dokumen.surat": { akibat: t("Surat masuk agenda dengan nomor dan berkasnya.", "The letter is logged with a number and its file."), href: "/app/surat", tempat: TEMPAT.surat },
  "dokumen.slip_gaji": { akibat: CATAT, href: "/app/lempar", tempat: TEMPAT.lempar },
  "dokumen.peb": { akibat: CATAT, href: "/app/lempar", tempat: TEMPAT.lempar },
  "dokumen.sppb": { akibat: CATAT, href: "/app/lempar", tempat: TEMPAT.lempar },
  "berkas.tinjau": { akibat: t("Nadi belum tahu jenis berkas ini. Bila disetujui, berkas hanya dicatat sebagai bukti; tidak ada data lain yang berubah.", "Nadi does not know this file type yet. If approved, the file is only recorded as evidence; no other data changes."), href: "/app/lempar", tempat: TEMPAT.lempar },
  "catatan": { akibat: CATAT, href: "/app/lempar", tempat: TEMPAT.lempar },
  "onboarding.usaha": { akibat: t("Profil usaha (kota, negara, jumlah orang, cabang) diperbarui.", "The business profile is updated."), href: "/app/perusahaan", tempat: TEMPAT.usaha },
  "onboarding.fitur": { akibat: t("Pilihan fitur usaha disimpan.", "The feature choice is saved."), href: "/app/perusahaan", tempat: TEMPAT.usaha },
  "onboarding.izin": { akibat: t("Aturan izin usaha diganti.", "The leave rule is changed."), href: "/app/perusahaan", tempat: TEMPAT.usaha },
  "onboarding.topi": { akibat: t("Topi (peran kerja) baru ditambahkan.", "New hats (work roles) are added."), href: "/app/orang", tempat: TEMPAT.orang },
  "info.kepatuhan": { akibat: INFO, href: "/app/kepatuhan", tempat: TEMPAT.kepatuhan },
  "info.beban_tim": { akibat: INFO, href: "/app/kerja", tempat: TEMPAT.kerja },
  "info.alur": { akibat: INFO, href: "/app/alur", tempat: TEMPAT.alur },
};

/** Aksi yang tercatat di database 6 Nov 2026 plus aksi pemicu; dipakai tes supaya tidak ada yang jatuh ke kalimat umum. */
export const AKSI_DIKENAL = Object.keys(PETA);

export function tujuanUsulan(aksi: string, b: Bahasa = "id"): Tujuan {
  const isi = PETA[aksi] ?? { akibat: CATAT, href: "/app", tempat: t("Feed keputusan", "Decision feed") };
  return { akibat: isi.akibat[b], href: isi.href, tempat: isi.tempat[b] };
}
