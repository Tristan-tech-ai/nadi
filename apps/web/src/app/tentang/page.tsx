import type { Metadata } from "next";
import Link from "next/link";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Tentang Nadi",
  description: "Nadi dibuat untuk usaha kecil Indonesia yang masih berjalan di atas nota, buku kas, dan chat WhatsApp.",
};

export default function Tentang() {
  return (
    <HalamanInfo
      judul="Tentang Nadi"
      pengantar="Usaha kecil di Indonesia berjalan di atas kertas: nota pemasok, buku kas bergaris, stempel toko, dan stabilo di daftar utang. Nadi tidak membuang dunia itu. Nadi membuatnya hidup."
    >
      <Bagian judul="Kenapa dibuat">
        <p>Pemilik warung, toko, dan kafe menghabiskan malam untuk menyalin nota, menghitung gaji, menagih pelanggan, dan menjawab izin karyawan. Aplikasinya ada, tetapi terpisah: satu untuk kasir, satu untuk gaji, satu untuk pembukuan, dan semuanya minta diketik ulang.</p>
        <p>Nadi mengubah berkas yang sudah ada menjadi usulan di satu Feed. Pemilik cukup menyetujui dari HP.</p>
      </Bagian>
      <Bagian judul="Cara kami bekerja">
        <ul className="list-disc space-y-1 pl-5">
          <li>Aturan pajak, BPJS, dan ketenagakerjaan diambil dari teks resmi dan diberi tanggal. Yang belum terverifikasi tidak dipakai.</li>
          <li>AI hanya mengusulkan. Keputusan uang selalu di tangan manusia.</li>
          <li>Tidak ada angka atau testimoni karangan di halaman kami. Yang belum jadi ditulis sedang dibuat.</li>
        </ul>
      </Bagian>
      <Bagian judul="Siapa">
        <p>
          Nadi dibuat oleh tim kecil di Indonesia dan sedang dalam masa uji. Coba{" "}
          <Link href="/demo" className="font-semibold text-tinta underline underline-offset-4">usaha contoh</Link> atau baca{" "}
          <Link href="/panduan" className="font-semibold text-tinta underline underline-offset-4">panduan per peran</Link>.
        </p>
      </Bagian>
    </HalamanInfo>
  );
}
