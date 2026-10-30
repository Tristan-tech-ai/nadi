# Suara dan bahasa Nadi

Nadi berbicara seperti **rekan kerja yang paham pembukuan dan tidak sok tahu**. Kalimatnya pendek, konkret, sopan tanpa basa-basi, dan menyebut angka kalau ada angkanya.

## Sapaan
- Pengguna disapa **"kamu"**, konsisten di semua layar. "Anda" hanya di dokumen resmi yang dicetak (surat, slip gaji, invoice).
- Nadi menyebut dirinya "Nadi", bukan "kami" atau "saya", kecuali di halaman tentang tim.

## Prinsip
1. **Kata kerja di depan, hasil di belakang.**
   - Benar: "Setujui gaji Budi". Salah: "Persetujuan gaji".
2. **Angka mengalahkan kata sifat.**
   - Benar: "3 orang belum absen sejak 08.00". Salah: "Beberapa karyawan terlambat".
3. **Pesan galat = apa yang terjadi + apa yang bisa dilakukan.**
   - Benar: "Foto nota buram. Foto ulang lebih dekat, atau ketik totalnya saja."
   - Salah: "Terjadi kesalahan."
4. **Istilah akuntansi jadi keterangan kedua.**
   - "Tagihan belum dibayar (piutang)" di tampilan pemilik; "Piutang" di Ruang Akuntan.
5. **Jujur soal AI.**
   - Usulan dari AI selalu menyebut keyakinan dan buktinya: "Dibaca dari nota, yakin 92%".
   - Nadi tidak pernah berpura-pura manusia.
6. **Tidak menyalahkan karyawan.**
   - Benar: "Absen belum tercatat". Salah: "Kamu tidak absen".
   - Selalu ada jalan banding.

## Kamus
| Pakai | Jangan | Catatan |
|---|---|---|
| tagihan / invoice | faktur (kecuali faktur pajak) | "Faktur pajak" khusus dokumen pajak Coretax |
| tagihan belum dibayar | piutang (di layar pemilik) | |
| absen masuk / absen pulang | clock in / check in | |
| izin, cuti, sakit | leave, permit | |
| topi | jabatan (untuk konsep multiperan) | Saat pertama muncul: "Topi = peran kerja. Satu orang bisa memakai beberapa topi." |
| usulan | rekomendasi AI, saran sistem | |
| setujui / tolak | approve / reject, konfirmasi | |
| Lempar | upload, unggah dokumen | Fitur "Lempar Saja"; tombol: "Lempar berkas" |
| kerja / tugas | task, job | |
| gaji, slip gaji | payroll, payslip | |
| perusahaan / usaha | tenant, organisasi | "Usahamu" untuk pemilik UMKM |
| masuk / keluar | login / logout, sign in | |
| simpan | submit, kirim (untuk formulir) | "Kirim" hanya bila benar-benar terkirim ke orang lain |

## Kata dan gaya terlarang (diperiksa `cek-slop.py`, aturan S33)
- **Basa-basi**: silakan, mohon maaf atas ketidaknyamanannya, dengan senang hati, terima kasih atas kesabaran Anda
- **Klise pemasaran**: revolusioner, inovatif, memberdayakan, solusi terbaik, all-in-one, seamless, tingkatkan produktivitas, game changer, mudah dan cepat, satu platform untuk semua, masa depan bisnis
- **Tanda baca dan simbol**: tanda pisah panjang (—) dan en dash (–); pakai titik, koma, atau titik dua. Tanpa emoji. Tanda seru maksimal satu per layar, hanya untuk keberhasilan besar.
- **Kata pengisi**: "sangat", "benar-benar", "secara signifikan" tanpa angka.

## Format (EYD; ⚠ aturan rupiah dari PUEBI II.H.5, cocokkan dengan teks resmi EYD V)
| Hal | Format | Contoh |
|---|---|---|
| Rupiah | Rp tanpa spasi dan tanpa titik, pemisah ribuan titik, desimal koma | Rp1.250.000, Rp12.500,50 |
| Rupiah ringkas (kartu kecil) | jt / rb dengan koma | Rp1,25 jt, Rp850 rb |
| Tanggal | hari bulan-singkat tahun | 31 Okt 2026; hari ini: "Hari ini, 08.15" |
| Jam | titik, 24 jam, zona perusahaan | 14.30 WITA |
| Persen | tanpa spasi | 92% |
| Nomor dokumen | huruf mono, apa adanya | 012/HRD/SK/X/2026 |
| Telepon | 08xx-xxxx-xxxx tampilan, +62 di data | |

## Contoh sebelum dan sesudah
| Sebelum | Sesudah |
|---|---|
| "Selamat datang di platform manajemen bisnis all-in-one yang revolusioner!" | "Lempar nota, slip, atau Excel apa saja. Nadi yang merapikan." |
| "Data berhasil disubmit." | "Tersimpan. Budi kini tercatat sebagai kasir." |
| "Error 500: Internal server error" | "Nadi gagal menyimpan. Coba lagi sebentar; isianmu tidak hilang." |
| "Tidak ada data." | "Belum ada usulan. Lempar berkas pertamamu, misalnya foto nota hari ini." |
| "Karyawan Anda terlambat." | "Absen Sari belum tercatat (jadwal 08.00). Tandai izin, atau tunggu sampai 08.30." |
| "AI merekomendasikan..." | "Usulan: tambah 1 pelayan Sabtu 18.00-20.00. Dasar: meja kotor rata-rata 11 menit minggu lalu." |

## Referensi
- UX writing, contoh lokal: https://dealls.com/pengembangan-karir/apa-itu-ux-writing
- Modul UX writing (voice, tone, microcopy): https://lmsspada.kemdiktisaintek.go.id/mod/url/view.php?id=159246
- Penelitian UX writing aplikasi Grab: https://journal.untar.ac.id/index.php/prologia/article/view/6415/4950
- Penulisan rupiah: https://penerbitdeepublish.com/aturan-penulisan-rupiah/ dan https://www.goodnewsfromindonesia.id/2023/07/22/cara-penulisan-rupiah-yang-benar-sesuai-eyd-dan-puebi
