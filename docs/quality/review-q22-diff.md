# Tinjauan berkas Q-22 sebelum commit agen (pola kerja satu sumber)

Ditulis 1 Nov 2026 (tick 212). Hanya membaca berkas agen yang belum di-commit:
- migrasi 20261101018000_pola_kerja_q22.sql (112 baris);
- komponen aturan-kerja.tsx dan form-aturan-kerja.tsx;
- modul lib/gaji/pola-kerja.ts beserta tesnya;
- perubahan pada perusahaan/page.tsx, actions.ts baru, lembur.test.sql, dan gaji.spec.ts.

Dibandingkan dengan docs/quality/rencana-uji-q22.md dan docs/design/aturan-kerja.md.

## Sesuai
- **Hak:** atur_pola_kerja memeriksa `app.peran_aktif() is distinct from 'pemilik'`, yaitu tabel anggota dan bukan klaim JWT (butir 3; pelajaran Q-23). Fungsi baca menerima pemilik, admin, dan akuntan; staf ditolak 42501, sesuai rancangan bahwa staf tidak melihat kartu.
- **Nilai tidak sah ditolak:** selain 6_hari/5_hari ditolak dengan 22023 (butir 2).
- **Audit:** perubahan menulis audit_log dengan nilai sebelum dan sesudah (butir 3).
- **Tulis langsung ditolak:** penulisan langsung kunci pengaturan pola oleh authenticated ditolak dengan pesan yang mengarahkan ke kartu Aturan kerja.
- **catat_lembur diubah lewat pola Q-24/Q-26:**
  - definisi hidup diganti teks dengan jumlah kemunculan diperiksa;
  - pesan penolakan menyebut pola usaha dan jalan keluarnya ("Ganti jenis hari, atau ubah Aturan kerja bila polanya memang berubah"). Ini sesuai VOICE: apa yang terjadi plus apa yang bisa dilakukan.
- **Kutipan hukum di kartu:** "Mengikuti PP 35/2021 Pasal 21 dan 22 serta PP 36/2021 Pasal 17. Total tetap 40 jam seminggu." Pasal 21-22 diverifikasi tick 202 (docs/research/pola-kerja.md) dan Pasal 17 di LEARN 1 Nov 2026.
- **Grep tanpa temuan:**
  - current_date, Asia/Makassar, app.prn(), app.pengelola() di migrasi;
  - "silakan", tanda pisah panjang, confirm(), alert() di komponen.

## Untuk diperiksa setelah commit (belum terlihat dari grep)
1. **Lembar dampak** harus menampilkan jumlah lembur libur lama yang nyata (butir 6). Cek dari kode form dan foto.
2. **Kotak centang Pasal 21 ayat (4)** ("Jam kerja kami diatur sendiri ...") ada di rancangan. Belum terlihat di grep; dicek apakah dibuat atau sengaja ditunda, beserta alasannya.
3. **Sidik migrasi = database;** tes pola_kerja_q22 dijalankan ulang terpisah; regresi lembur, slip_gaji, jwt_cabut_q21, klaim_fungsi_q23, isolasi_tenant.
4. **gaji.spec.ts diubah:** pastikan perubahan tidak melemahkan pemeriksaan lembur lama, hanya menyesuaikan jenis hari dengan pola usaha uji.
5. **Foto 390/1440 terang/gelap kartu Aturan kerja**, axe. Lalu e2e produksi setelah deploy (kuota).
- Tambahan tick 212: form-aturan-kerja.tsx memuat lembar bawah <dialog> (bukan dialog bawaan browser) dengan kalimatDampak dari jumlah lembur libur dan slip nyata, serta kotak centang 'Jam kerja kami diatur sendiri ...' (baris 70). Butir 1-2 tinggal dibuktikan dengan foto.
