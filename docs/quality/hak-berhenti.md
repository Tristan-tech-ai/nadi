# Hak keuangan orang yang berhenti (F3-07E)

Ditulis 4 Nov 2026. Dasar: docs/research/serah-terima-sql.md (hak_berhenti, ajukan_hak_berhenti), docs/research/upah-harian.md (PP 36/2021 Pasal 17), docs/research/serah-terima.md (PP 35/2021 Pasal 40 ayat (4), Pasal 50).

## Alur
1. Di Serah terima, pemilik melihat bagian "5. Hak keuangan" per paket. Admin hanya melihat kalimat bahwa bagian ini khusus pemilik.
2. `public.hak_berhenti(berhenti)` mengembalikan bahan hitungan. Fungsi ini khusus pemilik lewat `app.wajib_pemilik_berhenti`, yang memakai keanggotaan aktif, bukan klaim JWT. Bahannya:
   - gaji rahasia (`orang_rahasia.gaji`);
   - pola kerja (`app.pola_kerja`);
   - pembagi upah sehari dari aturan bertanggal `upah.pembagi_harian` {pola_6_hari: 25, pola_5_hari: 21}, terverifikasi;
   - jatah cuti tahunan (`kebijakan_izin` cuti);
   - cuti disetujui di tahun tanggal efektif;
   - uang pisah;
   - status usulan terakhir.
3. `src/lib/serah/hak.ts` (`hitungHak`) menghitung saran:
   - **Gaji sampai tanggal efektif:** `susunSlip` dijalankan dengan pokok dan tunjangan tetap dikali hari kerja (tanggal 1 sampai tanggal efektif; Minggu libur, Sabtu juga libur pada pola 5 hari) dibagi pembagi, paling banyak sebulan penuh. Yang disarankan adalah neto slip.
   - **Sisa cuti:** jatah dikurangi terpakai, tidak pernah negatif, lalu dikali upah sehari. Upah sehari = (pokok + tunjangan tetap) / pembagi. Bila jatah belum diatur, sisa cuti tidak dihitung; layar menyebutnya, bukan menampilkan 0.
   - **Pesangon:** "tidak berlaku" untuk alasan mundur (Pasal 50). Untuk alasan lain ditulis "belum dihitung".
4. Pemilik boleh mengubah ketiga angka (gaji terakhir, penggantian cuti, uang pisah), lalu menekan "Ajukan ke Feed". `public.ajukan_hak_berhenti(berhenti, rincian)` melakukan ini:
   - memeriksa bentuk angka: rupiah bulat, tidak negatif, total > 0;
   - menyimpan `berhenti.uang_pisah`;
   - membuat satu usulan `uang.hak_berhenti` untuk_peran `{pemilik}`, berisi penjelasan per komponen dan pasalnya;
   - bila usulannya masih menunggu, memperbarui usulan itu;
   - menolak dengan 23505 bila usulannya sudah disetujui.
5. Menyetujui di Feed hanya mencatat kejadian `uang.hak_berhenti` (cabang umum `putuskan_usulan`). Tidak ada slip, jurnal, atau pembayaran. Paket lalu menyebut "Bayar sendiri, lalu catat di pembukuan".

## Batas yang diketahui
- Hari libur nasional belum dikurangi dari hari kerja bulan terakhir. Layar menyebutnya, dan angkanya bisa diubah.
- PPh 21 atas penggantian cuti dan uang pisah tidak dihitung; angka itu bruto.
- Pesangon atau kompensasi untuk kontrak selesai (PKWT) dan alasan lain belum dihitung. Ini F4-09B (pesangon kontrak) dan keputusan pemilik.
- Gaji bulan terakhir yang sudah dibayar lewat Gaji tidak dikurangi otomatis. Pemilik mengosongkan atau mengubah barisnya.

## Bukti
- vitest `src/lib/serah/hak.test.ts` 7/7, merah dulu karena modul belum ada.
- Tes SQL `supabase/tests/hak_berhenti.test.sql` 22/22. Merah dulu: fungsi, aturan, dan kolom belum ada. Asersi format tanggal ditambah setelah foto Feed menampilkan "04-12-2026"; diperbaiki migrasi `20261104048100_hak_berhenti_tanggal.sql` menjadi "4 Des 2026" (VOICE.md).
- Migrasi `20261104048000_hak_berhenti.sql` (md5 tanpa spasi `24f874e9`) dan `20261104048100_hak_berhenti_tanggal.sql` (`b2f70bfc`) sama dengan berkas repo.
- e2e `e2e/hak-berhenti.spec.ts` menjalankan ini:
  - saran tampil;
  - tanpa pesangon menurut Pasal 50;
  - uang pisah diisi, diajukan, lalu status menunggu;
  - kartu Feed menyebut "pembayaran tetap kamu lakukan sendiri";
  - Setujui, lalu status diterima dan formulir hilang;
  - axe tanpa pelanggaran serius di 390 dan 1440 px, terang dan gelap;
  - tanpa gulir datar.
- e2e `@bahasa-akun` (Serah terima mode Inggris) dan `wawancara-keluar` tetap lulus.
- Advisor: WARN SECURITY DEFINER untuk `hak_berhenti` dan `ajukan_hak_berhenti`, pola yang sama dengan RPC lain. Hak diperiksa di dalam lewat `app.wajib_pemilik_berhenti`.
