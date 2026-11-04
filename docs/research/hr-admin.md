# HR administrasi (M-11)

Dibaca 5 Nov 2026.

## Surat peringatan
Sumber: PP 35/2021 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf, lapisan teks; hlm 23 dan 52).

- Pasal 36 huruf k: PHK dapat terjadi karena pekerja melanggar ketentuan perjanjian kerja (PK), peraturan perusahaan (PP), atau perjanjian kerja bersama (PKB) dan sebelumnya telah diberi surat peringatan pertama, kedua, dan ketiga berturut-turut, masing-masing berlaku paling lama 6 bulan kecuali ditetapkan lain dalam PK, PP, atau PKB.
- Pasal 52 ayat (1): hak pekerja yang di-PHK karena alasan itu (0,5 kali pesangon Pasal 40 ayat (2), 1 kali UPMK ayat (3), uang penggantian hak ayat (4)). Sudah dipakai di hitungan hak berhenti.
- Penjelasan Pasal 52 ayat (1):
  - SP diterbitkan berurutan. SP pertama berlaku 6 bulan.
  - Pelanggaran lagi dalam masa SP pertama boleh diberi SP kedua, berlaku 6 bulan sejak diterbitkan. Begitu juga SP ketiga (terakhir).
  - Pelanggaran dalam masa SP ketiga dapat menjadi dasar PHK.
  - Bila masa SP pertama sudah lewat, SP berikutnya kembali menjadi SP pertama; berlaku juga untuk SP kedua dan ketiga.
  - PK, PP, atau PKB boleh memuat pelanggaran tertentu yang langsung diberi peringatan pertama dan terakhir.

Yang dibangun (public.beri_sp):
- Tingkat dihitung database dari SP yang masih berlaku pada tanggal pelanggaran, bukan dipilih pengguna.
- Masa berlaku bawaan 6 bulan, bisa 1 sampai 12 bulan bila PK/PP/PKB menetapkan lain.
- Selama SP ketiga atau SP pertama dan terakhir berlaku, SP baru ditolak dengan pesan bahwa pelanggaran itu dapat menjadi dasar PHK. Nadi tidak melakukan PHK; hak berhenti tetap lewat /app/serah-terima.
- Tafsiran: "berlaku 6 bulan sejak diterbitkan" = tanggal SP sampai tanggal yang sama 6 bulan kemudian dikurangi 1 hari.

## Profil kerja, riwayat, bagan
- profil_kerja: jabatan, level, departemen/cost center, atasan langsung, status kerja (PKWTT, PKWT dengan tanggal akhir, harian lepas, magang, paruh waktu).
- riwayat_kerja: setiap perubahan jabatan, level, departemen, atau atasan (masuk, promosi, mutasi, demosi). Perubahan tanggal kontrak saja tidak menambah riwayat.
- Atasan harus orang di usaha yang sama dan tidak boleh membuat lingkaran; database menolak.
- Bagan organisasi digambar dari atasan langsung.

## Pengumuman
- Untuk semua orang atau per peran. Tanda baca per akun; pengelola melihat jumlah anggota aktif sasaran dan yang sudah membaca. Feed menampilkan jumlah yang belum dibaca.

## Daftar periksa
- Onboarding dan offboarding, masing-masing 6 butir bawaan yang dicentang pengelola.

## M-11B
- Kolom data tambahan: tipe teks, angka, tanggal (YYYY-MM-DD sah), pilihan, ya/tidak; database menolak isian yang tidak cocok. Staf hanya melihat kolom yang ditandai boleh dilihat. Kolom dinonaktifkan, tidak dihapus.
- Survei: skala 1-5, pilih satu, jawaban bebas; sekali per akun. Anonim: siapa yang mengisi disimpan terpisah (survei_isi, hanya tanggal), jawaban tanpa akun dengan id acak; pengelola hanya melihat ringkasan, dan ringkasan baru dibuka setelah 3 jawaban; jawaban teks diacak urutannya. Tidak anonim: pengelola melihat jawaban per orang.
- Persetujuan bertingkat: usulan izin.setujui dan lembur.ajukan dari staf yang punya atasan langsung berakun staf berstatus menunggu_atasan (tidak tampil di Feed). Atasan memutus lewat Feed-nya (langkah_saya, putuskan_langkah); setuju = diteruskan ke Feed pemilik/admin dengan catatan siapa yang menyetujui; tolak wajib alasan dan izin langsung ditolak. Bila atasan sedang izin/sakit/cuti yang disetujui, delegasi yang aktif pada tanggal itu menyetujui atas nama atasan; tanpa delegasi, langsung ke pemilik. Atasan yang pemilik/admin tidak memakai langkah ini karena sudah memutus di Feed.
- SP terbit sebagai surat keluar jenis surat_peringatan bernomor {no}/{kode}/SP/{bulan}/{tahun} dengan QR verifikasi /v; isinya menyebut pelanggaran, dasar, masa berlaku, dan akibat sesuai tingkat.
- Templat dokumen bebas dengan penanda {nama}, {jabatan}, {level}, {departemen}, {status}, {kontrak_sampai}, {mulai}, {usaha}, {tanggal}; penanda lain ditolak; hasilnya draf surat keluar jenis dokumen (nomor DOK) yang diterbitkan dari halaman Surat keluar. Contoh bawaan hanya surat penawaran kerja; isi kontrak PKWT ditulis pemilik dan layar mengingatkan memeriksa aturan.

## Belum
- Formulir pengajuan bebas (selain survei).
- Rantai lebih dari dua tingkat dan untuk jenis lain (uang, kasbon).
