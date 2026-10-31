# Tinjauan migrasi F3-02 bagi_adil (kode agen, sebelum commit)

Ditulis 1 Nov 2026 oleh loop, membaca supabase/migrations/20261101007000_bagi_adil.sql (150 baris, belum di-commit).

## Sesuai rencana (docs/quality/rencana-uji-f3-02.md)
- **Beban dari poin estimasi**: app.beban_orang menjumlah `coalesce(k.poin_beban, 0)`; komentar baris 2 menegaskan "bukan durasi aktual". Butir 3 rencana terpenuhi di SQL.
- **Hak**: beban_minggu dan usulan_pelaksana hanya pemilik/admin (`app.anggota_aktif(array['pemilik','admin'])`); beban_saya untuk anggota aktif mana pun tetapi hanya mengembalikan poin dirinya, rata-rata tim (bila n >= 3), dan tanda di_atas (> 1,5 kali rata-rata); tanpa nama atau id rekan. app.beban_orang, app.awal_minggu, app.teks_poin dicabut dari public/anon/authenticated dan hanya dipanggil fungsi security definer. Semua fungsi `set search_path = ''`.
- **Usulan pelaksana**: alasan satu kalimat dengan angka ("Budi: 6 poin minggu ini, paling ringan di antara kasir"), menyebut seri bila ada.

## Catatan (tidak memblokir)
- **Inferensi di tim kecil**: dengan tepat 3 orang, staf mengetahui poin dirinya dan rata-rata, sehingga bisa menghitung jumlah poin dua rekan lainnya (bukan masing-masing). Untuk n = 2 rata-rata disembunyikan. Dapat diterima: yang terungkap hanya total beban kerja rekan, bukan data pribadi; dicatat agar KPI F3-03 memakai ambang yang sama atau lebih ketat.
- Jam jadwal belum ada (F3-06), jadi besar poin kerja baru tidak mengubah pilihan pelaksana (semua jam sama); komentar fungsi mengakuinya.

## Masih harus dibuktikan saat agen selesai
Sidik berkas = database, tes SQL bagi_adil hijau + regresi, get_advisors, dan butir 1, 2, 6, 7, 8 rencana uji.
