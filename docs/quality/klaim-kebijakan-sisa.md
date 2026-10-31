# Lima kebijakan RLS masih hanya memakai klaim JWT (sisa Q-21)

Ditulis 1 Nov 2026 (tick 193) dari kueri pg_policies produksi. Ditemukan saat menyiapkan brief Q-23.

## Temuan
Q-21 mengganti 17 kebijakan SELECT/ALL agar memeriksa keanggotaan sungguhan (app.anggota_aktif / app.peran_aktif). Ada lima kebijakan lain yang masih memakai `app.pid()` dan `app.pengelola()`, dan keduanya hanya membaca klaim JWT:

| Kebijakan | Perintah | Hak authenticated | Dampak bila klaim basi |
|---|---|---|---|
| slip_gaji.slip_gaji_baca | SELECT | ada | **Admin yang dicabut atau diturunkan masih membaca slip gaji SEMUA orang** (bruto, potongan, neto, komponen) selama sisa umur token. |
| lembur.lembur_baca | SELECT | ada | Lembur semua orang tetap terbaca. |
| pengajuan_izin.pengajuan_izin_baca | SELECT | ada | Pengajuan izin semua orang tetap terbaca, termasuk alasan dan bukti sakit (id berkas). |
| berkas.berkas_ubah | UPDATE | **tidak ada** (Q-01 mencabut hak tulis) | Tidak bisa dipakai. Kebijakan tetap dirapikan supaya tidak terbuka bila hak dikembalikan. |
| berkas.berkas_hapus | DELETE | **tidak ada** | Sama. |

Rincian:
- **app.pid() juga klaim.** Anggota yang dicabut seluruhnya, bukan hanya diturunkan, tetap lolos `perusahaan_id = app.pid()` sampai token kedaluwarsa.
- **Umur token.** Umur token akses Supabase bawaan adalah 1 jam. Angka itu belum dicek di pengaturan proyek ini; cek di dashboard Auth bila perlu.

## Klaim yang ternyata salah
- docs/quality/jwt-setelah-cabut.md (tick 160-an) menulis "periode_gaji (status saja, bukan slip; slip_gaji memakai orang_saya)". Itu hanya separuh benar. slip_gaji_baca memang memakai orang_saya untuk staf, tetapi cabang pengelola memakai klaim `app.pengelola()`, dan cabang itulah yang membuka semua slip.
- Audit tick itu hanya menghitung kebijakan yang **seluruhnya** klaim. Kebijakan berbentuk `pengelola() OR orang_saya()` terlewat.

## Perbaikan (digabung ke Q-23, dinaikkan menjadi wajib)
- `(select app.pengelola())` diganti `(select app.peran_aktif()) in ('pemilik', 'admin')` di kelima kebijakan, lewat `alter policy` seperti Q-21.
- Untuk membatasi baris ke usaha anggota yang masih aktif, pola Q-21 adalah `perusahaan_id = app.pid() and app.anggota_aktif()`, karena app.peran_aktif() membaca anggota aktif untuk pid itu. Agen wajib membaca definisi app.peran_aktif dan memastikan bahwa anggota yang dicabut menghasilkan null, sehingga cabang staf (`orang_saya`) juga tertutup.
- Tes perilaku per tabel: admin diturunkan jadi staf dan admin dicabut, keduanya dengan JWT lama, membaca slip_gaji, lembur, dan pengajuan_izin orang lain, dan hasilnya harus 0 baris. Merah dulu.
- Cek struktur: 0 kebijakan di public/storage yang memuat `app.pengelola()` atau `app.prn()`.

## Bukti sebelum perbaikan (tick 195, transaksi dibatalkan, hanya hitungan)
- Pemilik sungguhan di usaha bergaji (19 slip). Klaim JWT disimpan (pid, prn=pemilik) lalu `set role authenticated`. Tidak ada admin di usaha bergaji, jadi yang dipakai pemilik. app.pengelola() menerima pemilik maupun admin.
  - Masih aktif: membaca 19 slip, sesuai harapan.
  - Diturunkan ke staf di tabel anggota, JWT lama: tetap membaca **19** slip, padahal seharusnya 0 (staf tanpa slip sendiri).
  - Dicabut (anggota.aktif = false), JWT lama: tetap membaca **19** slip, **2** baris lembur, dan 0 pengajuan izin (usaha ini memang tanpa pengajuan).
- Kesimpulan: celahnya nyata dan hanya dibatasi umur token. Tidak ada data yang diubah karena transaksi dibatalkan oleh raise exception.
