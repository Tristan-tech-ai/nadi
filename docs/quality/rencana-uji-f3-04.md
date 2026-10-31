# Rencana verifikasi loop untuk F3-04 (Peta Organisasi Nyata)

Ditulis 1 Nov 2026 saat F3-04 dikerjakan agen latar. Diperiksa loop sendiri sebelum `done F3-04`.

1. Sidik migrasi peta_organisasi = database; jumlah migrasi 52.
2. Tes SQL peta_organisasi dijalankan loop sendiri, hijau; regresi jwt_cabut_q21 17/17 dan kpi 40/40.
3. Hak: peta_organisasi memakai app.peran_aktif() (pola Q-21), bukan app.prn()/app.pengelola(); staf, anon, dan admin yang dicabut ditolak 42501. Cek dengan grep berkas migrasi.
4. Angka: persen per topi dihitung dari poin kerja selesai (bukan jumlah kerja), kerja batal tidak dihitung, ambang < 3 kerja tampil "belum cukup kerja".
5. Lintas topi terlihat sebagai teks "lintas topi" (bukan warna saja) di graf, tabel, dan daftar HP.
6. Graf SVG punya padanan teks: tabel dengan isi sama, graf aria-hidden; axe tanpa pelanggaran serius.
7. Tombol "Pasang topi" membuat usulan untuk pemilik (CHECK Q-17), idempoten; tidak mengubah pakai_topi langsung.
8. Foto 390/1440 terang/gelap: HP berupa daftar (bukan graf sempit), tidak menyalahkan karyawan, satu tombol utama.
9. Vercel READY lalu e2e peta.spec terhadap produksi dengan --output terpisah.
