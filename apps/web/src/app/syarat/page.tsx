import type { Metadata } from "next";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Syarat layanan Nadi",
  description: "Aturan memakai Nadi selama masa uji.",
};

export default function Syarat() {
  return (
    <HalamanInfo
      judul="Syarat layanan"
      pengantar="Aturan memakai Nadi selama masa uji, dalam bahasa sehari-hari."
      draf="Ditulis tim Nadi dan belum ditinjau ahli hukum. Versi resmi akan menggantikan halaman ini sebelum tagihan pertama."
    >
      <Bagian judul="Masa uji">
        <p>Selama masa uji semua paket gratis dan belum ada tagihan. Fitur bisa berubah, dan kamu akan diberi tahu di aplikasi sebelum tagihan mulai berlaku. Tidak ada tagihan yang dibuat tanpa persetujuanmu.</p>
      </Bagian>
      <Bagian judul="Tanggung jawabmu">
        <ul className="list-disc space-y-1 pl-5">
          <li>Data yang kamu masukkan benar dan kamu berhak memakainya, termasuk data karyawan.</li>
          <li>Kamu memeriksa usulan sebelum menyetujui. Hitungan gaji, PPh 21, BPJS, dan pajak UMKM mengikuti aturan resmi yang dirujuk di layar, tetapi tetap periksa bersama akuntanmu.</li>
          <li>Kamu menjaga kata sandi dan PIN, dan mencabut akses orang yang sudah tidak bekerja.</li>
          <li>Nadi tidak boleh dipakai untuk menghindari pajak, menyembunyikan karyawan, atau mendiskriminasi pelamar.</li>
        </ul>
      </Bagian>
      <Bagian judul="Tanggung jawab Nadi">
        <ul className="list-disc space-y-1 pl-5">
          <li>Menjaga data setiap usaha terpisah dan hanya memprosesnya untuk fitur yang kamu pakai.</li>
          <li>Tidak mengambil keputusan uang atas namamu.</li>
          <li>Memberi tahu bila ada gangguan atau kebocoran yang menyangkut datamu.</li>
        </ul>
      </Bagian>
      <Bagian judul="Batas">
        <p>Nadi adalah alat bantu. Selama masa uji layanan diberikan apa adanya, dan bisa terhenti sementara untuk perbaikan. Keputusan akhir atas gaji, pajak, rekrutmen, dan pembayaran tetap milik usaha.</p>
      </Bagian>
    </HalamanInfo>
  );
}
