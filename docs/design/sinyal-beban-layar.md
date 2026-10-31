# Kartu Feed "Beban dan kabar tim" (F3-07, sinyal risiko beban)

Ditulis 1 Nov 2026, pasangan docs/research/sinyal-risiko-beban.md. Muncul di Feed pemilik (bukan admin, bukan staf), paling banyak satu kartu per orang per minggu, dibuat hari Senin setelah minggu sebelumnya selesai di zona usaha.

## Bentuk kartu
- Tanpa cap SETUJUI/TOLAK: ini info, bukan keputusan. Tombol utama satu: "Lihat bebannya" (ke /app/kerja?tab=beban dengan orang itu disorot). Tombol teks: "Sudah ditangani" (menutup kartu, tercatat siapa dan kapan; muncul lagi hanya bila sinyal menyala 3 minggu berikutnya).
- Judul kalimat angka, isi maksimal tiga baris, satu baris per sinyal yang menyala.

## Teks per sinyal (VOICE: angka dulu, tidak menyalahkan, ada jalan)
- **Beban berat 3 minggu**: judul "Sari memikul 1,8 kali beban rata-rata tim, 3 minggu berturut-turut." Baris: "12, 14, 13 poin per 40 jam; rata-rata tim 7 poin. Kerja kasir bisa dibagi ke Budi atau Dewi (paling ringan di topi kasir)." Nama pengganti dari usulan_pelaksana (F3-02), bukan dari model.
- **Lintas topi naik**: "Sari mengerjakan 9 kerja di luar topinya 3 minggu terakhir (sebelumnya 3). Bila memang tugasnya sekarang, pasang topinya di Peta organisasi." Tautan ke tab peta.
- **Izin sakit lebih sering**: "Sari mengambil 4 hari sakit dalam 4 minggu, lebih sering dari biasanya (rata-rata 1). Mungkin perlu ditanya kabarnya." Tanpa alasan, tanpa bukti, tanpa diagnosis.
- Kata yang tidak pernah dipakai: "berisiko", "keluar", "resign", "tidak loyal", "malas", skor atau warna merah untuk orang.

## Keadaan
- Riwayat izin < 12 minggu: baris sakit tidak muncul; di kaki kartu: "Kabar izin sakit muncul setelah 12 minggu data."
- Tim < 3 orang dengan kerja: kartu beban tidak dibuat sama sekali (perbandingan tidak bermakna).
- Jam masih 40 untuk semua (sebelum F3-06): kaki kartu "Jam kerja dianggap 40 seminggu sampai jadwal shift diisi."
- Kosong (tidak ada sinyal): tidak ada kartu; tidak ada kalimat "semua baik" yang mengisi Feed.

## Hak dan data
- Usulan berjenis info untuk_peran {pemilik} (CHECK Q-17), sumber 'sinyal', payload {orang_id, sinyal[], angka}; tidak bisa dibaca admin/staf (RLS usulan_baca dengan app.peran_aktif, Q-21).
- Idempoten per (orang, minggu): kunci dari hash orang_id + awal minggu, supaya cron yang berjalan dua kali tidak membuat dua kartu.

## Uji
Tes SQL (lihat riset) + e2e: pemilik melihat kartu dengan angka dan tautan ke Beban; admin dan staf tidak melihatnya; "Sudah ditangani" menutup kartu; foto 390/1440 terang/gelap; axe.
