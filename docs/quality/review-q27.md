# Verifikasi loop Q-27 (rata-rata beban tim)

Ditulis 1 Nov 2026 (tick 195) mengikuti docs/quality/rencana-uji-q27.md.

| Butir | Hasil |
|---|---|
| 1. Sidik dan hak | Berkas 20261101015000_rata_beban_q27.sql = database = b54660dd (58 migrasi). Menurut laporan agen, ACL beban_saya tetap: authenticated boleh, anon tidak. |
| 2. Data uji sungguhan | Warung Uji A, minggu 26 Okt sampai 1 Nov: app.beban_orang 50 baris, kelompok pemakai papan kerja menurut hitungan loop = 0. beban_saya dipanggil sebagai staf uji: n_kelompok 0, rata_rata null, di_atas false. Fungsi lama untuk data yang sama memberi n 50 dan rata 0. |
| 3. Tes ulang terpisah | rata_beban_q27 merah 11 dari 14, lalu hijau 14/14 (dijalankan agen). Tes ulang oleh pihak terpisah: belum. |
| 4. Regresi | Agen pembantu: bagi_adil 27, kpi 40, papan_kerja 58, hari_ini_q26 52, isolasi_tenant 38, semuanya gagal=[]. bagi_adil disesuaikan karena dua cek lama mengunci aturan lama (staf 3,8 n=4 menjadi 5 n=3). Perubahan itu sah. |
| 5. Teks | Vitest merah 4 lalu 73/73; seluruh rangkaian 424/424. grep "Rata-rata tim 0" di apps/web/src = 0. Catatan agen: "Rata-rata tim 0,5." tetap sah menurut rancangan. |
| 6. Foto | Foto 390 terang layar staf (scratchpad/foto-q27/kerja-staf-selesai-390-light.png): "Minggu ini 2 poin. Rata-rata tim tampil bila minimal 3 orang memakai papan kerja minggu ini." Kalimat "di atas rata-rata" hilang. |
| 7. Produksi | **Belum.** Vercel tidak membuat deploy untuk push agen 846c2df. Deploy terakhir b7e8032, dicek lima menit setelah push. |
| 8. Advisor | Menurut agen, tidak ada jenis temuan baru. |

## Temuan sampingan: push agen tidak memicu deploy Vercel
- **Polanya:** dua kali, push yang dilakukan agen latar tidak menghasilkan deploy sama sekali.
  - 48b27e1 (Q-25): tertolong karena push loop berikutnya, 48b00a6, ikut membawanya.
  - 846c2df (Q-27): belum tertolong.
- Push dari loop selalu menghasilkan deploy. Penulis commit sama (email noreply Tristan-tech-ai). Penyebabnya belum diketahui; dugaan sementara, deploy yang berdekatan atau di-push dalam satu rentang waktu digabung atau dilewati Vercel.
- **Aturan sementara:** setelah push agen, loop selalu memeriksa daftar deployment, dan bila commit agen tidak ada, ia dibawa oleh push loop berikutnya. Q-27 belum boleh di-done-kan sebelum Vercel READY dan e2e produksi kerja.spec lulus.
