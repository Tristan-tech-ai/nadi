# Gerbang keputusan cepat (F1-06): rancangan v1

Ditulis 31 Okt 2026 sebelum kode. Tangga kecerdasan Nadi: aturan pasti, lalu model, lalu manusia. Jev (model keputusan lewat AI Gateway) belum bisa dipanggil karena tim Vercel belum punya kartu (R-02C, docs/research/jev.md), jadi tingkat model v1 memakai model ringan yang sudah dipakai baca-berkas, dengan bentuk jawaban yang sama dengan `src/lib/jev.ts` (`pilihan`, `peluang`, `yakin`). Saat Jev aktif, hanya adapter tingkat model yang berganti.

## Kriteria terima (ditulis sebelum kode)
1. **Jejak.** Setiap keputusan otomatis tercatat di `public.keputusan`: jenis, subjek, tingkat (`aturan` | `model`), pilihan, keyakinan, alasan dalam kalimat manusia, latensi ms, waktu. Pengelola bisa membacanya; staf tidak.
2. **Bisa dibatalkan.** `batalkan_keputusan(id, alasan)` (pemilik/admin) membalik akibatnya dan mencatat siapa, kapan, dan mengapa. Keputusan yang dibatalkan tidak bisa dibatalkan dua kali.
3. **Latensi p50 tercatat.** `ringkasan_keputusan(hari)` mengembalikan jumlah, p50, dan p95 latensi per jenis dan tingkat; angka nyata dicatat di docs/quality/keputusan.md.
4. **Ambang.** Keyakinan >= 0,85 langsung dipakai; 0,5 sampai < 0,85 dinaikkan ke model; < 0,5 diserahkan ke manusia tanpa tindakan otomatis. Aturan pasti selalu keyakinan 1.

## Titik pakai v1
| Jenis | Subjek | Tingkat aturan | Akibat | Pembatalan |
|---|---|---|---|---|
| `izin.otopilot` | pengajuan_izin | kebijakan izin (F1-03) | pengajuan disetujui + kejadian `izin.*` | pengajuan kembali `menunggu`, kejadian dibalik dengan kejadian `izin.batal`, usulan `izin.setujui` masuk Feed |
| `usulan.rute` | usulan baru | aksi dan nilai: uang dengan `dampak_rp` >= ambang usaha (bawaan Rp5.000.000) hanya ke pemilik; absen, izin, orang, dokumen ke admin dan pemilik; lainnya tetap ke keduanya | `usulan.untuk_peran` | `untuk_peran` dikembalikan ke `{pemilik, admin}` |

Tingkat model untuk `usulan.rute` (judul + penjelasan yang tidak tertangkap aturan, misalnya usulan `catatan` dari asisten MCP) dikerjakan di tick berikutnya lewat Edge Function, karena butuh panggilan keluar; v1 mencatat kasus itu sebagai `manusia` (tetap ke keduanya) sehingga jumlah yang perlu model terukur dulu.

## Data
`public.keputusan`: id, perusahaan_id, jenis, subjek_id, tingkat, pilihan, peluang jsonb, yakin real, alasan text, latensi_ms real, model text (ID dari konfigurasi, bukan kode), dibuat_at, dibatalkan_at, dibatalkan_oleh, alasan_batal. RLS baca pengelola; tulis hanya lewat fungsi. Latensi tingkat aturan diukur dengan `clock_timestamp()` di dalam fungsi yang memutuskan.

## Tes yang direncanakan
SQL: izin otomatis tercatat dengan alasan dan latensi; pembatalan membalik status dan memunculkan usulan; batal dua kali ditolak; staf tidak bisa membaca atau membatalkan; rute usulan uang besar hanya ke pemilik dan admin tidak melihatnya; pembatalan rute mengembalikan peran; p50 terhitung; isolasi usaha.
