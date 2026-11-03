import type { Metadata } from "next";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";

export const metadata: Metadata = {
  title: "Kebijakan privasi Nadi",
  description: "Data apa yang dikumpulkan Nadi, untuk apa, di mana disimpan, dan hakmu atas datamu.",
};

export default function Privasi() {
  return (
    <HalamanInfo
      judul="Kebijakan privasi"
      pengantar="Data apa yang Nadi simpan, untuk apa, dan apa yang bisa kamu lakukan dengannya."
      draf="Ditulis tim Nadi dari cara kerja aplikasi yang sebenarnya dan belum ditinjau ahli hukum. Rujukan: Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (ditetapkan 17 Oktober 2022); pasal-pasalnya belum dicocokkan satu per satu."
    >
      <Bagian judul="Siapa yang memegang data">
        <p>Pemilik usaha yang mendaftar menentukan data karyawan, pelanggan, dan pemasok apa yang masuk ke Nadi. Nadi memproses data itu atas nama usaha tersebut, hanya untuk menjalankan fitur yang dipakai.</p>
      </Bagian>
      <Bagian judul="Data yang disimpan">
        <ul className="list-disc space-y-1 pl-5">
          <li>Akun: email, nama, dan peran di setiap usaha. Staf tanpa email memakai akun dengan kode usaha dan ID staf.</li>
          <li>Data karyawan yang dimasukkan usaha: nama, nomor HP, topi (peran kerja), data gaji, dan 4 digit akhir NIK beserta sidiknya.</li>
          <li>Berkas yang dilempar (foto nota, PDF, Excel) dan hasil bacaannya.</li>
          <li>Kejadian kerja: absen, izin, jadwal, tagihan, dan keputusan, dengan waktu dan pelakunya.</li>
          <li>Hasil cek wajah saat absen hanya berupa lulus atau tidak; foto wajah tidak disimpan dan tidak diunggah.</li>
          <li>Rekaman suara wawancara yang dikirim pelamar dan transkripnya, hanya untuk usaha yang membuka lowongan itu.</li>
        </ul>
      </Bagian>
      <Bagian judul="Untuk apa dan dengan siapa">
        <p>Data dipakai untuk fitur yang kamu lihat di aplikasi. Data tidak dijual dan tidak dipakai untuk iklan. Berkas yang perlu dibaca AI dikirim ke penyedia model AI melalui server Nadi; angka panjang seperti nomor rekening disamarkan lebih dulu bila memungkinkan.</p>
        <p>Penyedia layanan yang dipakai: penyedia database dan penyimpanan berkas (pusat data Singapura), penyedia hosting web, dan penyedia model AI. Pesan ke karyawan atau pelanggan dikirim dari HP-mu sendiri lewat WhatsApp, bukan oleh Nadi.</p>
      </Bagian>
      <Bagian judul="Berapa lama disimpan">
        <p>Log kejadian mentah disimpan 90 hari dan log audit 180 hari, lalu hanya ringkasannya yang tetap ada. Data usaha (orang, slip gaji, tagihan, jurnal) disimpan selama usaha memakai Nadi. Usaha contoh di /demo berisi data karangan dan bisa dilihat siapa saja.</p>
      </Bagian>
      <Bagian judul="Hakmu">
        <p>Kamu bisa melihat dan membetulkan datamu di aplikasi. Untuk meminta salinan atau penghapusan data, pemilik usaha menghubungi Nadi; alamat resminya sedang disiapkan. Karyawan yang ingin datanya dibetulkan atau dihapus menghubungi pemilik usahanya lebih dulu.</p>
      </Bagian>
    </HalamanInfo>
  );
}
