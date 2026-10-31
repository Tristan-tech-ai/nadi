# Izin dan cuti dengan otopilot (F1-03)

Ditulis 31 Okt 2026 sebelum kode. Masalah P05 (izin menunggu atasan) dan P10 (dampak ke shift).

## Aturan sumber
- Cuti tahunan "paling sedikit 12 hari kerja setelah 12 bulan bekerja terus-menerus" (Pasal 79 UU 13/2003 diubah UU 6/2023) BELUM terverifikasi dari teks resmi (lihat loop/LEARN.md). Karena itu jatah cuti tahunan adalah isian kebijakan pemilik, tanpa angka bawaan hukum. Layar pengaturan menampilkan catatan "periksa aturan ketenagakerjaan yang berlaku".

## Rancangan data
- `kebijakan_izin` per usaha dan jenis (`sakit`, `izin`, `cuti`): `otomatis` (boleh disetujui tanpa manusia), `maks_hari_otomatis`, `butuh_bukti` (surat dokter dsb.), `maks_bersamaan` (orang lain yang sedang izin pada hari yang sama), `jatah_tahunan` (khusus cuti, boleh kosong).
- `pengajuan_izin`: orang, jenis, mulai, selesai, hari, alasan, `bukti_berkas_id`, status `menunggu|disetujui|ditolak`, `oleh_otopilot`, `alasan_putusan` (selalu diisi, mis. "Disetujui otomatis: sakit 1 hari dengan surat dokter, sesuai kebijakan sakit").
- Saldo cuti dihitung dari `jatah_tahunan` dikurangi hari cuti disetujui di tahun berjalan (tidak disimpan ganda).

## Alur
1. Staf mengajukan dari PWA (`ajukan_izin`). Fungsi menilai kebijakan:
   - semua syarat terpenuhi (otomatis aktif, hari <= batas, bukti ada bila wajib, kuota bersamaan aman, saldo cukup untuk cuti): disetujui otopilot, kejadian `izin.<jenis>` dicatat, alasan ditulis.
   - salah satu tidak terpenuhi: pengajuan menunggu dan usulan `izin.setujui` masuk Feed dengan alasan mengapa butuh keputusan manusia ("melebihi 1 hari", "2 orang lain sudah izin hari itu", "saldo cuti tinggal 1 hari").
2. Pemilik/admin memutuskan di Feed; `putuskan_usulan` mengubah status pengajuan dan mencatat kejadian bila disetujui.
3. Karyawan selalu melihat alasan putusan dan bisa mengajukan ulang (VOICE: tidak menyalahkan karyawan, selalu ada jalan banding).

## Tes yang direncanakan
Otopilot menyetujui kasus sesuai kebijakan dengan alasan tercatat; melebihi batas hari, tanpa bukti wajib, kuota bersamaan penuh, dan saldo kurang masuk Feed; isolasi antar usaha; staf hanya melihat pengajuannya sendiri.
