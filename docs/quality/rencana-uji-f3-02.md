# Rencana verifikasi loop untuk F3-02 (pembagi tugas adil)

Ditulis 1 Nov 2026 saat F3-02 dikerjakan agen latar. Daftar yang diperiksa loop sendiri sebelum `done F3-02`, terpisah dari laporan agen.

1. Uji unit contoh dokumen dijalankan ulang oleh loop: Gini awal 0,2105, rakus 0,3129, adil 0,0769, urutan 4 Budi, 3 Dewi, 2 Budi, 2 Budi (docs/research/bagi-adil-algoritma.md).
2. 50 benih acak: tidak ada satu pun benih yang adil >= rakus; bila ada, kriteria antrean tidak terpenuhi walau rata-ratanya turun.
3. Beban per jam memakai poin estimasi, bukan durasi aktual (staf lambat tidak dihukum). Diperiksa di SQL beban_minggu.
4. Staf tidak bisa membaca beban orang lain lewat fungsi apa pun (tes SQL + coba panggil RPC dengan JWT staf di produksi).
5. Sidik migrasi bagi_adil = database; get_advisors tanpa anon baru.
6. Tangkapan 390/1440 terang/gelap: penanda "paling berat" berupa teks + stabilo, bukan warna saja; tidak ada deretan tiga kartu sama besar.
7. e2e produksi setelah Vercel READY.
8. Jam jadwal sama rata (40) ditulis jujur di layar sampai F3-06 ada.
