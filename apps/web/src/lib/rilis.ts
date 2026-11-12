// L-12 catatan rilis (setara release note Mekari). Hanya perubahan yang sudah berjalan di produksi, ditulis dari loop/DECISIONS.md
// dan commit yang terpasang; setiap butir menautkan layar, alat, atau artikel bantuan yang ada (diuji).
export type Rilis = { tanggal: string; judul: string; isi: string; tautan: { href: string; label: string } };

const r = (tanggal: string, judul: string, isi: string, href: string, label: string): Rilis => ({ tanggal, judul, isi, tautan: { href, label } });

export const RILIS: Rilis[] = [
  r("2026-11-06", "Alat gratis tanpa akun", "Kalkulator gaji bersih (PPh 21 TER, BPJS, lembur), THR, pesangon, slip gaji online, dan pembuat invoice. Rumus dan aturannya sama dengan aplikasi.", "/alat", "Buka alat gratis"),
  r("2026-11-06", "Pusat bantuan dan kamus istilah", "Satu artikel untuk setiap layar Nadi, artikel langkah untuk hal yang paling sering ditanya, dan kamus istilah pajak, gaji, dan pembukuan.", "/bantuan", "Buka pusat bantuan"),
  r("2026-11-06", "Coba aplikasi sungguhan tanpa daftar", "Buka usaha contoh Toko Bu Sari sebagai pemilik. Semua layar bisa dibuka; perubahan tidak disimpan dan AI tidak dipakai.", "/demo", "Coba Nadi"),
  r("2026-11-06", "Lupa kata sandi dan masuk lewat email", "Atur ulang kata sandi dari halaman Masuk, atau masuk lewat email tanpa kata sandi. Halaman Masuk kini menanyakan kamu masuk sebagai pengelola atau staf.", "/bantuan/artikel/tidak-bisa-masuk", "Baca caranya"),
  r("2026-11-06", "Salin prompt lengkap untuk AI-mu", "Satu prompt berisi alamat server Nadi, cara memasang sambungan, alat yang boleh dipakai, dan batasannya, supaya AI-mu yang menyiapkan usahamu.", "/bantuan/artikel/sambung-ai", "Baca caranya"),
  r("2026-11-06", "CCTV langsung di Mata", "Tombol Sambungkan CCTV di layar Mata memutar CCTV lewat jembatan di komputer toko, sehingga zona bisa digambar di gambar CCTV. Video tidak lewat server Nadi.", "/bantuan/artikel/mata", "Tentang Mata"),
  r("2026-11-06", "Halaman untuk jenis usaha dan integrasi", "Halaman untuk warung, kafe, katering, konveksi, bengkel, salon, laundry, kos, kursus, dan kontraktor, serta daftar sambungan yang sudah berjalan.", "/untuk", "Lihat jenis usaha"),
  r("2026-11-06", "Rincian sebelum menyetujui", "Setiap usulan di Feed menyebut akibatnya bila disetujui dan menampilkan apa yang ditambah atau diubah, sebelum kamu memutuskan.", "/bantuan/artikel/lempar-dan-setujui", "Baca caranya"),
  r("2026-11-06", "Nadi belajar format berkasmu", "Struk, berkas pindahan, dan pertanyaan dengan format baru dibaca AI sampai polanya cocok dua kali lagi; sesudahnya dibaca dengan aturan tersimpan tanpa biaya AI. Aturan diperiksa pengawas yang bukan AI.", "/bantuan/artikel/data-dan-ai", "Apa yang dibaca AI"),
  r("2026-11-06", "Menu baru dan pencarian fitur", "Menu menyesuaikan ukuran layar (HP, tablet, komputer), cari fitur dengan Ctrl K, sematkan halaman favorit, dan Semua menu dengan gunanya.", "/bantuan/artikel/feed-keputusan", "Mulai dari Feed"),
  r("2026-11-06", "Alur otomatis, tanya data, dan pindah dari aplikasi lain", "Buat alur seperti invoice lunas langsung jadi kerja gudang, tanyakan angka usahamu dengan kalimat biasa, dan bawa data dari aplikasi lama.", "/bantuan/artikel/pindah-aplikasi", "Pindah ke Nadi"),
];
