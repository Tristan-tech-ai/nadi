# Hasil uji F3-07 Serah terima (1 Nov 2026)

Rancangan: docs/research/serah-terima.md, serah-terima-sql.md, docs/design/serah-terima-layar.md.

| Butir | Hasil |
|---|---|
| Migrasi 20261101026000_serah_terima | sidik bbb187dd = database (70 migrasi); pg_cron nadi-cabut-berhenti menit ke-5 tiap jam |
| Tes SQL supabase/tests/serah_terima.test.sql | merah (tabel belum ada), lalu 27/28 (kesalahan tes: subkueri dan fungsi di satu pernyataan memakai snapshot lama, jebakan yang sudah tercatat di STATE), lalu 28/28: paket 2 topi, 2 kerja berjalan, 1 ilmu (topi yang hanya dipakai orang itu), 2 akses otomatis (akun, token tablet), 4 akses manual; pengganti = rekan bertopi sama dengan kerja terbuka paling sedikit; peringatan 30 hari tidak memblokir; idempoten; satu proses aktif per orang; pemilik tidak bisa diberhentikan; pada hari efektif belum dicabut, sehari sesudahnya dicabut (anggota dan orang nonaktif, topi berakhir, token dicabut, akun staf dikunci); rekan tidak tersentuh; JWT lama 0 baris di orang/kerja/kejadian/usulan/slip; batal tidak dicabut; isolasi usaha |
| e2e serah-terima.spec (lokal, desktop) | lulus: akun staf masih bisa masuk sebelum dicatat; paket dengan peringatan Pasal 36, usulan pengganti, akun Nadi, 4 akses manual; pindahkan 1 kerja; centang akses manual; axe 390/1440 terang/gelap |

Sengaja belum (tugas F3-07C/D/E): Rekam Ilmu suara ke langkah kerja, wawancara keluar, hak keuangan sebagai usulan Feed.
