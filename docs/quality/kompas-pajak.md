# Hasil uji F4-07 Kompas Pajak (1 Nov 2026)

Sumber dan rancangan: docs/research/kompas-pajak.md (naskah resmi PP 20/2026 dan PP 55/2022).

| Butir | Hasil |
|---|---|
| Migrasi 20261101030000_kompas_pajak | sidik 1df42585 = database (79 migrasi). Sebelum apply: fungsi dan baris aturan belum ada |
| Tes SQL supabase/tests/kompas_pajak.test.sql | 13/13: aturan pph.final_umkm terverifikasi bersumber PP 20/2026 (0,5%, Rp4,8 M, Rp500 jt); posisi_pajak menjumlah kredit-debit akun pendapatan per bulan (penjualan + pendapatan lain; jurnal balik mengurangi; beban dan tahun lain tidak ikut); profil hanya pemilik dengan bentuk dan isian rupiah tervalidasi; staf, anon, dan usaha lain ditolak atau tidak melihat |
| Vitest src/lib/pajak/kompas.test.ts | 13/13: bagian bebas Rp500 jt kumulatif untuk orang pribadi (contoh 100 jt sebulan = Rp3.500.000 setahun), bulan yang melewati Rp500 jt hanya bagian di atasnya, PT perorangan dan koperasi tanpa bagian bebas, Pasal 61 bulan lewat Rp4,8 M dicatat, badan lain tidak dihitung; batas gabungan tahun lalu (dengan usaha lain dan pasangan), tahun berjalan lewat, aman dengan sisa ruang, badan lain tidak berlaku dengan dasar Pasal II; simulator 3 hitungan berdasar hukum (contoh bruto 2 M laba 300 jt K/1: Rp7.500.000, Rp10.000.000, Rp29.550.000), badan tarif umum tidak dihitung dan dikatakan, peringatan gabungan tanpa saran memecah usaha. Merah sengaja: bagian bebas diberikan ke semua bentuk, 3 tes gagal, dipulihkan |
| e2e apps/web/e2e/pajak.spec.ts (lokal, desktop) | lulus: profil orang pribadi + usaha lain tahun lalu Rp5 M = "lewat_tahun_lalu" dengan dasar Pasal 57 ayat (2) huruf e; diubah 0 = "boleh"; nilai tersimpan tetap terlihat di formulir; kalimat posisi "Kalau tutup buku hari ini, PPh final ..."; simulator angka di atas; axe 0 serius 390/1440 terang/gelap |

Temuan yang diperbaiki: setelah simpan, React mengosongkan formulir sehingga bentuk usaha tampil "Pilih" padahal tersimpan. Formulir profil kini terkendali; e2e memeriksa nilainya tetap.

Catatan jujur: tahun di layar memakai jam server (bukan zona usaha), sehingga beberapa jam di sekitar pergantian tahun bisa menampilkan tahun sebelumnya.
