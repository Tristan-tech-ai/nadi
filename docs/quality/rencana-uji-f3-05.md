# Rencana verifikasi loop untuk F3-05 (Kolam Bonus Beban)

Ditulis 1 Nov 2026 sebelum F3-05 dibangun. Diperiksa loop sendiri sebelum `done F3-05`; rancangan: docs/design/kolam-bonus-beban.md.

1. Sidik migrasi kolam bonus = database; tes SQL dijalankan loop sendiri, hijau; regresi kpi, jwt_cabut_q21, slip_gaji tetap gagal=[].
2. Jumlah semua bagian = kolam persis untuk kolam yang tidak habis dibagi (mis. Rp1.000.000 dibagi 3 orang poin sama: 333.334 + 333.333 + 333.333), dibuktikan tes SQL dan vitest (sisa terbesar, deterministik untuk seri: urut id).
3. Hak: setujui hanya pemilik lewat app.peran_aktif() = 'pemilik'; admin melihat pratinjau saja; staf hanya bagiannya (kolam_saya); pemilik/admin yang dicabut ditolak dengan JWT lama (pola Q-21).
4. Poin dari kerja.poin_beban kerja selesai di bulan itu (zona usaha), sama dengan KPI F3-03; kerja batal tidak dihitung; ambang < 5 kerja selesai menolak pembagian dengan pesan jelas.
5. Komponen slip: setelah disetujui, slip periode bulan itu memuat komponen 'insentif_beban' (pendapatan) dengan label "Insentif beban kerja" dan sumber PP 36/2021 Pasal 8 dan 10; PPh 21 ikut berubah, dasar BPJS tidak (cek susunSlip dengan tes unit).
6. Slip yang sudah disetujui tidak berubah diam-diam: kolam untuk bulan yang slipnya sudah disetujui ditolak atau menunggu periode berikut (tes SQL).
7. Ekspor CSV: kolom orang, ID staf, poin, persen, rupiah, sumber; angka rupiah tanpa titik ribuan di CSV (bisa dibaca spreadsheet), nama berkas memuat bulan; tes unit pembuat CSV termasuk nama dengan koma dan tanda kutip.
8. Foto 390/1440 terang/gelap: Rupiah lewat komponen Rupiah, satu tombol utama, tidak ada peringkat terbuka antarstaf, keterangan insentif vs bonus tampil.
9. Vercel READY lalu e2e kolam bonus terhadap produksi dengan --output terpisah.
