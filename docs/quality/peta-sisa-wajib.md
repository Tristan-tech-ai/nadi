# Peta 27 tugas wajib tersisa (1 Nov 2026, tick 208)

Sumber: loop/WORK_QUEUE.json (wajib, belum done), progres 47/74. Tujuan: urutan kerja, ketergantungan nyata, dan pasangan yang bisa dikerjakan agen paralel tanpa bentrok berkas. Paralel hanya bila daerah berkasnya terpisah **dan** salah satunya tidak perlu commit selama yang lain berjalan (pelajaran kebuntuan push tick 195-199).

## Rantai ketergantungan
- **SDM dan operasi:** Q-22 (berjalan) → F3-06 shift (butuh pola kerja untuk batas 7 atau 8 jam) → F3-07 serah terima (upah harian /25 atau /21 dari pola kerja). F2-07 hanya butuh F3-03 (sudah selesai).
- **Keuangan:** F4-01 Nomor Sakti → F4-02 surat dari kalimat. F4-04 ledger → F4-05 invoice (juga butuh F4-01) → F4-06 mutasi bank. F4-04 → F4-07 Kompas Pajak → F4-08 Ruang Akuntan. F4-03 agenda surat masuk hanya butuh Lempar (sudah ada).
- **F4-09 cadangan pesangon:** butuh F1-05 (selesai). Ditambah peringatan bahwa UU Pelindungan Ketenagakerjaan belum berlaku (R-UUPK).
- **Penglihatan:** F5-01 Mata di browser → F5-02 Peta Usaha, F5-04 agen edge RTSP. F5-03 Analis Malam butuh F3-03 (selesai).
- **Platform:** F6-01 paket industri, F6-02 pembanding anonim (k ≥ 10), F6-03 process mining (butuh F4-05), F6-05 ekspor skill asisten, F6-06 video promo + panduan (paling akhir, setelah fitur stabil).
- **Kualitas lintas fitur:** Q-04 perburuan bug adversarial, Q-05 aksesibilitas penuh. Paling berguna dikerjakan setelah sebagian besar layar F4 ada, tetapi Q-05 bisa dicicil per layar.
- **Q-06:** terblokir sampai rilis keamanan Next.js 3 Nov 2026.
- **DONE-01:** skenario akhir. Butuh F5-03, F4-07, F3-07, F2-06.

## Urutan yang diusulkan
1. Q-22 (berjalan), lalu Q-30 + Q-31 (kecil, loop sendiri, satu push).
2. F4-01 Nomor Sakti (m): daerah baru (surat/nomor), tidak bentrok dengan layar kerja.
3. F3-06 shift (l): butuh Q-22. Pekerjaan terbesar di jalur SDM; rancangan sudah ada (docs/research/solver-shift.md, shift-f3-06-sql.md, docs/design/tukar-shift.md).
4. F4-04 ledger (l): fondasi seluruh jalur keuangan.
5. F3-07 serah terima (m), F4-02, F4-03, F4-09 (s), F2-07.
6. F4-05 → F4-06 → F4-07 → F4-08.
7. F5-01 → F5-02, F5-03, F5-04.
8. F6-01, F6-02, F6-03, F6-05, Q-04, Q-05, F6-06.
9. Q-06 setelah 3 Nov 2026 (kecil, kapan pun slotnya ada).
10. DONE-01.

## Pasangan yang aman diparalelkan
Satu agen kode + satu agen riset/rancangan. Riset hanya menulis docs/ atau scratchpad, jadi tidak memblokir push.
- **F4-01 (kode) bersama rancangan F4-04 (riset jurnal kaku, posting idempoten, periode terkunci).**
- **F3-06 (kode) bersama riset F4-07 (PP 20/2026 harus dibaca dari teks resmi lebih dulu; angka pajak belum terverifikasi tidak boleh dipakai).**
- **Dua agen kode sekaligus hanya bila:**
  - daerah berkas apps/web dan supabase/migrations benar-benar terpisah;
  - nomor migrasi dibagi di brief;
  - hanya satu agen yang push. Agen kedua commit lokal tanpa push, lalu loop yang push.

  Saat ini belum dipakai karena wake_guard menolak commit yang belum di-push. Butuh perubahan aturan bila mau dipakai.

## Batas nyata yang memperlambat
- **Kuota deploy Vercel Hobby 100 per hari:** setiap push kode sebaiknya membawa satu tugas utuh. e2e produksi menumpuk saat kuota habis.
- **Supabase Free 500 MB dan storage 1 GB:** F5 (video/kamera) perlu hemat. Rencana kapasitas ada di docs/quality/kapasitas.md.
- **Teks hukum yang belum terbit atau belum dicek:** UU Pelindungan Ketenagakerjaan (R-UUPK), PP 20/2026 (F4-07).
