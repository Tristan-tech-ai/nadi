# Biaya operasi per usaha (H-01)

Diukur 3 Nov 2026 dengan `app.biaya_usaha(pid, bulan)` dan `app.biaya_platform(bulan)` (migrasi 20261103039000_biaya_usaha,
sidik cc4028dd, tes SQL biaya_usaha 14/14, merah dulu: fungsi belum ada). Fungsi hanya bisa dipanggil operator (postgres), tidak
lewat API.

## Cara hitung
- **Token AI**: setiap baris public.pemakaian_ai x harga di public.konfigurasi `harga_ai` (USD per juta token: masuk, keluar,
  cache baca, cache tulis 5 menit), harga prompt panjang bila masuk + cache > ambang, diskon batch 50% untuk tugas `analis_malam`.
  Model tanpa harga tidak dihitung tetapi tokennya dilaporkan (`token_tanpa_harga`), jadi kebocoran harga terlihat.
- **Storage**: ukuran objek bucket berkas di jalur `{pid}/` saat fungsi dipanggil (bukan per bulan) x tarif lebih per GB.
- **Database**: perkiraan, jumlah baris kejadian/usulan/audit/slip/orang x byte per baris dari docs/quality/kapasitas.md x tarif lebih per GB.
- **Rupiah**: USD x kurs di konfigurasi.

## Harga yang dipakai (diakses 3 Nov 2026)
| Hal | Nilai | Sumber |
|---|---|---|
| Model berat | $2 masuk, $10 keluar, $0,10 cache baca, $2,50 cache tulis per juta token | halaman pricing resmi penyedia model AI |
| Model ringan | $0,10 / $0,50 / $0,01 / $0,125; prompt > 100.000 token: $0,50 / $2,50 / $0,05 / $0,625 | idem |
| Batch | diskon 50% masuk dan keluar | idem |
| Storage | $0,0213 per GB (lebih dari 100 GB Pro) | supabase.com/pricing |
| Database | $0,125 per GB (lebih dari 8 GB Pro) | supabase.com/pricing |
| Kurs | Rp18.148 per USD | JISDOR Bank Indonesia, 3 Nov 2026 |
ID model tidak ditulis di repo; harga dipasang per ID lewat SQL dari kunci model_ai.

## Angka nyata 30 hari terakhir (data uji, bukan pelanggan)
Semua usaha saat ini adalah usaha uji e2e, demo, dan usaha percobaan loop. Angka ini membuktikan alat ukurnya, bukan perilaku
pelanggan.

| Bulan | Usaha | Aktif | Total | Median aktif | p90 | Maks |
|---|---|---|---|---|---|---|
| Okt 2026 | 23 | 4 | $0,4637 | $0,0858 | $0,0585 | $0,2921 |
| Nov 2026 (1-3) | 23 | 6 | $0,0018 | $0,0002 | $0,0003 | $0,0010 |

Biaya AI per panggilan (Okt-Nov, semua usaha):

| Tugas | Panggilan | Total | Per panggilan |
|---|---|---|---|
| tulis_aturan (model berat, sekali per tata letak baru) | 37 | $0,4020 | $0,0109 |
| baca_berkas | 108 | $0,0551 | $0,00051 |
| rute_usulan_uji | 20 | $0,0037 | $0,00019 |
| rute_usulan | 6 | $0,0013 | $0,00021 |
| estimasi_kerja | 15 | $0,0016 | $0,00011 |
| analis_malam (batch) | 6 | $0,0007 | $0,00012 |
Storage total semua usaha: 242 objek, 6,6 MB.

## Skenario satu usaha aktif per bulan (perkiraan dari tabel di atas, belum diukur di pelanggan)
Warung 10 orang yang melempar 300 berkas per bulan, 20 tata letak baru, Sarapan Data 30 malam:
- baca berkas 300 x $0,00051 = $0,153
- tulis aturan 20 x $0,0109 = $0,218 (turun setelah tata letak dikenal: berkas berikutnya 0 token)
- analis malam 30 x $0,00012 = $0,004
- storage 300 x 289 KB = 87 MB, sekitar $0,002 bila sudah di atas kuota
- **total sekitar $0,38, sekitar Rp6.900 per bulan** (kurs di atas)
Biaya tetap (paket Supabase/Vercel, domain) tidak termasuk; dibagi per usaha di B-03.

## Batas yang diketahui
- Egress, panggilan Edge Function, pesan Realtime, dan menit build Vercel tidak terbaca dari SQL; dihitung di B-03 dari kuota paket.
- Storage adalah keadaan saat ini, bukan rata-rata bulanan.
- Biaya model yang dipanggil dari peramban (Mata, transkrip, OCR) = 0 bagi Nadi karena berjalan di perangkat pengguna.
