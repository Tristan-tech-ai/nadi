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

## Verifikasi loop setelah push agen (1 Nov 2026, tick 145)
1-2. vitest adil.test.ts dijalankan ulang: 69/69 (contoh Gini 0,2105 / 0,3129 / 0,0769, urutan 4 Budi, 3 Dewi, 2 Budi, 2 Budi; 50 benih adil < rakus).
3-4. Tes SQL bagi_adil dijalankan loop sendiri di produksi: HASIL_TES 27 | gagal=[] (poin estimasi bukan aktual 600 menit; staf 42501 untuk beban_minggu, usulan_pelaksana, app.beban_orang; anon 42501).
5. Sidik berkas = database = 23c4a873042a85bb7e8e26aa6cad66c2 (49 migrasi). get_advisors security: 21 fungsi anon, tidak ada fungsi baru F3-02 di antaranya; beban_minggu/beban_saya/usulan_pelaksana hanya WARN authenticated (pola diterima).
6. Foto 390/1440 terang/gelap dilihat: "paling berat" teks + stabilo; daftar satu kolom, bukan tiga kartu; usulan di dialog dengan alasan berangka dan "Kamu bebas memilih orang lain".
7. Vercel produksi READY untuk 0c72ad7; e2e bagi-adil.spec terhadap produksi lulus (27,8 dtk).
8. Layar: "Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama (40 jam seminggu)."

## Catatan tambahan
- Rata-rata tim staf menghitung semua orang aktif termasuk yang 0 poin; di Warung Uji A (±49 orang uji) rata-rata 0,2 sehingga hampir semua yang punya kerja "di atas rata-rata". Untuk tim nyata ini jujur (orang tanpa kerja memang ringan); dibiarkan.
- Advisor memperlihatkan public.rute_model_uji_mulai dan rute_model_uji_catat bisa dipanggil authenticated. Diperiksa (migrasi keputusan_model baris 169-208): disengaja untuk eval pemilik/admin (scripts/eval-keputusan.ts), 42501 untuk peran lain, batas 40 per hari, catat token hanya sekali per baris usahanya sendiri. Bukan celah. Kecil: batas hari memakai Asia/Makassar tetap, bukan perusahaan.zona_waktu (geser paling banyak 1 jam untuk usaha WIB); dicatat, tidak diubah.
