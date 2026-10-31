# Ramalan kebutuhan orang per jam (F3-06, bagian ramalan)

Ditulis 1 Nov 2026. Bagian terakhir F3-06 yang belum dirancang (lihat docs/research/solver-shift.md "Di luar bagian ini"). Penyusun jadwal butuh masukan "berapa orang per topi per jam"; tulisan ini menjawab dari mana angka itu datang hari ini dan nanti.

## Data yang benar-benar ada sekarang (docs/research/kpi-sumber.md, kueri produksi 1 Nov 2026)
- kejadian: izin.*, absen.harian (impor rekap Excel, per hari, tanpa jam), uang.keluar, kerja.*; **tidak ada absen.masuk sungguhan, tidak ada penjualan per jam** (belum ada POS atau bayar.masuk dari mutasi bank).
- kerja: poin_beban dan selesai_at per topi (F3-01/F3-02): jumlah kerja selesai per topi per jam bisa dihitung, tetapi sangat jarang (3 kerja selesai di 1 usaha uji).
- Kesimpulan: hari ini **tidak ada sinyal permintaan per jam** yang cukup untuk meramal. Mengaku meramal dari data itu berarti mengarang (melanggar VOICE prinsip 5 "jujur soal AI" dan aturan angka hanya dari data nyata, ANTI-SLOP S34).

## Rancangan bertahap
1. **Tahap 0 (dibangun bersama F3-06)**: kebutuhan diisi pemilik sebagai pola mingguan per topi ("kasir: Senin-Jumat 2 orang 07.00-21.00, Sabtu-Minggu 3 orang 10.00-21.00"). Disimpan di tabel kebutuhan_shift (perusahaan, topi, hari 1-7, jam_mulai, jam_selesai, jumlah). Layar menulis "Kebutuhan diisi kamu. Nadi belum punya data penjualan per jam untuk menyarankan angka."
2. **Tahap 1 (setelah ada minimal 4 minggu sinyal)**: saran = rata-rata hari yang sama (Senin dengan Senin) 4 minggu terakhir per jam, dari sinyal yang ada, dibulatkan ke atas ke orang utuh lewat rasio "sinyal per orang per jam" yang ditetapkan pemilik sekali (mis. 12 transaksi per kasir per jam). Tidak ada model AI; rumus ditampilkan apa adanya: "Senin 12.00-13.00: rata-rata 31 transaksi 4 Senin terakhir, 1 kasir melayani 12, jadi 3 kasir." Sinyal kandidat menurut ketersediaan:
   - bayar.masuk per jam dari mutasi bank / QRIS (fase uang F4, bank mutation P09),
   - antrean dan meja terisi dari Mata (F5-01: kejadian meja.kosong / antrean),
   - kerja selesai per topi per jam (sudah ada, tetapi jarang).
3. **Tahap 2 (opsional, nanti)**: koreksi hari libur nasional dan tanggal gajian (tanggal 25 sampai 1), hanya bila tahap 1 terbukti meleset; perlu sumber resmi daftar libur (SKB 3 Menteri tahun berjalan) sebelum dipakai.

## Aturan jujur saat data kurang
- Kurang dari 4 minggu sinyal untuk satu jam tertentu: tidak ada saran, tampil "Belum cukup data (2 dari 4 minggu)".
- Saran tidak pernah mengubah kebutuhan sendiri; pemilik menekan "Pakai saran" (usulan, bukan otomatis), dan angka lama tetap tersimpan.
- Simpangan: tampilkan rentang (minimum-maksimum 4 minggu) di samping rata-rata, supaya pemilik melihat ketidakpastian.
- Ukur kesalahan sendiri: setiap minggu bandingkan saran minggu lalu dengan sinyal nyata (MAE orang per jam); tampilkan di layar "Saran minggu lalu meleset rata-rata 0,4 orang per jam". Bila MAE lebih buruk dari "pakai minggu lalu apa adanya", saran dimatikan otomatis untuk jam itu.

## Akibat untuk F3-06
Kriteria "ramalan kebutuhan" di judul F3-06 dipenuhi dengan Tahap 0 (pola kebutuhan isian pemilik yang dipakai solver) + kerangka Tahap 1 yang mati sampai sinyal cukup, diuji dengan sinyal sintetis 4 minggu (vitest: rata-rata hari sama, pembulatan ke atas, "belum cukup data" saat 3 minggu, MAE). Tahap 1 hidup sungguhan baru setelah bayar.masuk (F4) atau Mata (F5-01) menghasilkan kejadian per jam.
