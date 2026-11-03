import type { Metadata } from "next";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Keamanan data Nadi",
  description: "Data setiap usaha dipisah di database, AI tidak memutuskan uang, NIK tidak disimpan utuh, kamera diproses di perangkat.",
};

// Setiap klaim di halaman ini punya bukti di repo (tes SQL, e2e, atau dokumen sumber); lihat docs/quality/keamanan-f0.md.
export default function Keamanan() {
  return (
    <HalamanInfo judul="Keamanan data" pengantar="Yang Nadi lakukan untuk datamu, ditulis apa adanya. Bila sesuatu belum dilakukan, halaman ini menyebutnya.">
      <Bagian judul="Data setiap usaha terpisah">
        <p>Database memeriksa setiap baris sebelum dibaca atau diubah (row level security): baris hanya terlihat oleh anggota usaha pemiliknya, sesuai perannya. Pemisahan ini diuji otomatis pada setiap perubahan database, termasuk percobaan membaca data usaha lain.</p>
        <p>Staf hanya melihat data dirinya: absen, izin, dan slip gajinya sendiri. Akuntan bisa melihat dan mengekspor, tetapi tidak bisa menyetujui gaji atau usulan.</p>
      </Bagian>
      <Bagian judul="Tempat dan jalur data">
        <p>Database dan berkas disimpan di pusat data Singapura. Semua API menerima koneksi HTTPS saja (TLS 1.2 atau 1.3).</p>
        <p>Kunci rahasia (kunci AI, kunci pemberitahuan) disimpan terenkripsi di brankas database atau sebagai rahasia server, tidak pernah ada di HP, browser, atau kode.</p>
      </Bagian>
      <Bagian judul="AI tidak memutuskan uang">
        <p>AI membaca berkas dan menyusun usulan. Data baru tercatat setelah pemilik atau admin menyetujui. Gaji, pelunasan tagihan, dan perubahan data orang selalu lewat tombol manusia.</p>
        <p>Yang berjalan otomatis hanya aturan yang dipasang pemilik sendiri, seperti izin sakit sampai batas hari tertentu. Setiap keputusan otomatis tercatat dengan alasannya dan bisa dibatalkan. Keluaran AI diperlakukan sebagai masukan yang tidak tepercaya: AI tidak bisa menyembunyikan apa pun dari pemilik atau menghapus data.</p>
      </Bagian>
      <Bagian judul="Data pribadi diperkecil">
        <p>NIK tidak disimpan utuh: hanya sidik acak dan 4 digit akhirnya. Nomor rekening dan NIK dibandingkan lewat sidik untuk menemukan data ganda di Gerbang Gaji, tanpa membuka nilai aslinya.</p>
        <p>Mata (kamera meja) dan transkrip wawancara berjalan di HP atau laptop pengguna. Gambar kamera tidak diunggah; yang dikirim hanya status meja dan panjang antrean.</p>
      </Bagian>
      <Bagian judul="Masuk dan tautan">
        <p>PIN staf terkunci 15 menit setelah 5 kali salah. Kode absen QR berganti tiap 15 detik dan hanya bisa dipakai sekali per orang untuk jenis absen yang sama.</p>
        <p>Tautan slip gaji dan tablet absen membawa token di bagian URL yang tidak terkirim ke server, berlaku terbatas, dan bisa dicabut. Asisten AI yang kamu sambungkan lewat MCP hanya mendapat izin untuk satu usaha dan bisa dicabut kapan saja.</p>
      </Bagian>
      <Bagian judul="Yang belum dilakukan">
        <p>Belum ada audit keamanan dari pihak luar dan belum ada sertifikasi. Cadangan mingguan ke penyimpanan terpisah sedang dibuat. Alamat resmi untuk melaporkan celah keamanan sedang disiapkan.</p>
      </Bagian>
    </HalamanInfo>
  );
}
