# Verifikasi loop F3-05 (Kolam Bonus Beban)

Ditulis 1 Nov 2026 (tick 203) mengikuti docs/quality/rencana-uji-f3-05.md.

| Butir | Hasil |
|---|---|
| 1. Sidik dan tes SQL | Berkas 20261101017000_kolam_bonus.sql = database = fed04553 (59 migrasi). Agen: kolam_bonus 63/63 setelah merah. Catatan jujur agen: merahnya hanya potongan awal berkas. Regresi 10 berkas gagal=[]. Tes ulang terpisah kolam_bonus, slip_gaji, kpi: sedang berjalan (hasil dicatat di bawah). |
| 2. Sisa terbesar | Vitest: Rp1.000.000 dibagi 3 poin sama menjadi 333.334 (id terkecil) + 333.333 + 333.333. Produksi (foto pratinjau 390): Sari Rp333.334, Budi dan Dewi Rp333.333, jumlah Rp1.000.000. |
| 3. Hak | Setuju/simpan/batal hanya pemilik lewat app.peran_aktif(); admin pratinjau; staf lewat kolam_saya. Kebijakan tanpa app.prn/pengelola (cek struktur di tes agen). |
| 4. Poin dan ambang | Dari kerja selesai di bulan zona usaha; batal tidak dihitung; ambang 5 kerja berpoin setelah pengecualian (e2e menguji penolakan). |
| 5. Slip | Komponen insentif_beban masuk slip draf. Vitest: PPh 21 naik dari Rp125.448 ke Rp155.106 (TER A 1,75%), iuran BPJS tetap. Dasar hukum "insentif tidak masuk dasar BPJS" BELUM TERVERIFIKASI; layar menyebutnya sebagai perilaku Nadi, bukan klaim hukum. |
| 6. Slip disetujui terkunci | Bulan dengan periode gaji disetujui menolak kolam baru, setuju, dan batal (tes SQL agen). |
| 7. CSV | Vitest: nama dengan koma, kutip, dan rumus "=" aman; rupiah tanpa titik ribuan; nama berkas kolam-insentif-beban-YYYY-MM.csv. |
| 8. Foto | 20 foto produksi (scratchpad/foto-f305-prod). Rupiah lewat komponen, satu tombol utama "Setujui pembagian", urut nama bukan peringkat, keterangan insentif vs bonus tampil dengan pasal. Catatan kecil: isian "Jumlah kolam (Rp)" menampilkan 1000000 tanpa pemisah ribuan saat diketik. |
| 9. Produksi | Deploy git f05a266 READY (dpl_edMUU9bK...); e2e produksi kolam.spec (pindah-kolam) lulus 35,5 dtk; CI GitHub success 562dd28. |

## Sisa yang dicatat agen
- Orang yang punya bagian kolam tetapi belum punya gaji pokok tidak mendapat slip. Layar "Siapkan gaji" menyebut jumlahnya.
- Dasar BPJS untuk insentif belum diverifikasi ke teks resmi.
- Tes ulang terpisah (tick 205): kolam_bonus 63, slip_gaji 27, kpi 40, semuanya gagal=[]. F3-05 SELESAI.
