# Jalur Magang, topi mentor, dan Dana Rekrutmen (F2-06)

Ditulis 1 Nov 2026. Masalah P14: peserta magang di UMKM sering dipakai sebagai tenaga murah tanpa rencana, mentor membimbing di sela pekerjaannya tanpa dihitung, dan pemilik tidak tahu berapa sebenarnya biaya mendapatkan satu karyawan.

## Sumber regulasi (BELUM TERVERIFIKASI ke PDF resmi JDIH Kemnaker)
Teks Permenaker 6/2020 tentang Penyelenggaraan Pemagangan di Dalam Negeri dibaca dari https://pasal.id/peraturan/permen/permenaker-no-6-tahun-2020 (diakses 1 Nov 2026; situs itu menandai dokumen "diproses, belum ditinjau"). Salinan PDF di situs pemerintah daerah gagal dibuka (sertifikat kedaluwarsa). Karena itu angka di bawah hanya dipakai sebagai **peringatan**, tidak pernah sebagai larangan atau perhitungan uang:
- Pasal 5 ayat (5): jangka waktu pemagangan paling lama 1 tahun.
- Pasal 5 ayat (2): program memuat antara lain kurikulum dan silabus; ayat (4): teori dan simulasi 10% sampai 25%.
- Pasal 10: perjanjian pemagangan tertulis, memuat hak dan kewajiban, program, jangka waktu, dan besaran uang saku.
- Pasal 13 ayat (2): uang saku meliputi biaya transportasi, uang makan, dan insentif (besaran tidak ditetapkan).
- Pasal 7 huruf a: pembimbing adalah pekerja di penyelenggara paling singkat 6 bulan. Tidak ada rasio pembimbing terhadap peserta.
- Pasal 2: peserta paling banyak 20% dari jumlah pekerja perusahaan.

## Keputusan
1. **Rencana magang tertulis** per peserta: tujuan, topi tujuan, mentor (orang di usaha), tanggal mulai dan selesai, uang saku per bulan (transport, makan, insentif, terpisah), rencana per minggu (keahlian dan target), uji akhir. Bisa dicetak sebagai lampiran perjanjian (pemilik menandatangani di luar Nadi).
2. **Peringatan lunak** (bukan blokir): durasi > 1 tahun, uang saku kosong, mentor bekerja < 6 bulan, peserta magang aktif > 20% dari orang aktif. Setiap peringatan menyebut sumbernya dan status "belum terverifikasi".
3. **Mentor adalah topi** (kode `mentor`, dibuat otomatis bila belum ada) dengan porsi kecil; kerja peserta di luar topi magangnya tertanda lintas topi oleh trigger yang sudah ada.
4. **Buku jam rekrutmen** (satu tabel untuk dua jenis): `mentor` (sesi bimbingan, per rencana magang) dan `penilai` (menit menilai pelamar, per lamaran, diisi dari kartu Keputusan). Tarif per jam dari pengaturan usaha `tarif_jam_rekrut` (diisi pemilik, bawaan kosong; gaji orang tidak dibaca agar data rahasia tidak dipakai di laporan). Tarif disalin ke setiap baris saat dicatat.
5. **Dana Rekrutmen**: anggaran bulanan (pengaturan usaha) dibanding jam mentor + penilai bulan itu. **Biaya per rekrutmen** = (jam mentor rencana + jam penilai lamaran) × tarif + biaya iklan (isian per lowongan), ditampilkan per orang yang diterima atau magang yang selesai.
6. Nilai uji akhir magang masuk ke Bank Talenta (magang selesai dengan nilai lulus muncul sebagai kandidat pertama di lowongan bertopi sama) di tugas lanjutan, bukan v1.

## Kriteria terima rinci
- Biaya per rekrutmen (jam mentor + penilai) tampil di laporan /app/magang, dihitung dari buku jam (tes SQL dan e2e).
- Rencana magang tersimpan dengan rencana mingguan; peringatan lunak muncul untuk durasi > 1 tahun dan uang saku kosong.
- Hanya pemilik/admin menulis rencana dan tarif; mentor boleh mencatat sesinya sendiri; usaha lain tidak melihat apa pun (tes SQL).
- UI 390/1440 terang/gelap, axe bersih, e2e lokal dan produksi.
