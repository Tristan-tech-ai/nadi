# Gerbang keputusan cepat: angka nyata

Diukur 31 Okt 2026 dari tabel `public.keputusan` di produksi (proyek Supabase Singapura), berisi keputusan yang dibuat oleh e2e izin dan gaji yang dijalankan terhadap produksi. Latensi diukur di dalam database dengan `clock_timestamp()`: untuk izin sejak awal transaksi RPC `ajukan_izin` sampai keputusan tersimpan; untuk rute usulan selama trigger berjalan. Waktu jaringan pengguna tidak termasuk.

| Jenis | Tingkat | Jumlah | Dibatalkan | p50 | p95 | Maks |
|---|---|---|---|---|---|---|
| izin.otopilot | aturan | 3 | 3 | 11,1 ms | 14,0 ms | 14,3 ms |
| usulan.rute | aturan | 6 | 0 | 1,2 ms | 2,1 ms | 2,3 ms |

Catatan jujur:
- Sampel masih kecil (9 keputusan, semuanya dari uji). Angka ini membuktikan pencatatan dan ringkasan bekerja di produksi; p50 untuk beban nyata dibaca ulang dari kartu "Keputusan otomatis" setelah ada pemakaian.
- Ketiga izin otomatis dibatalkan oleh e2e (menguji pembatalan), bukan karena salah putus.
- Tingkat model belum ada (Jev menunggu kartu Vercel; model ringan lewat Edge Function adalah F1-06B), jadi belum ada latensi tingkat model.
