# Hasil uji F4-03 Agenda surat masuk (1 Nov 2026)

Rancangan: docs/research/agenda-surat.md.

| Butir | Hasil |
|---|---|
| Migrasi 20261101023000_agenda_surat | sidik b6bfdb7c = database (64 migrasi). Dua bahaya ditemukan sebelum apply: CHECK pihak_cara/pihak_orang_id akan menggagalkan hapus orang (on delete set null), dan nomor/jenis surat > 120 huruf dari bacaan model akan menggagalkan persetujuan; keduanya diperbaiki |
| Tes SQL supabase/tests/agenda_surat.test.sql | merah (tabel dan fungsi belum ada), lalu 21/22 (kesalahan tes: baris usaha A dibaca dengan JWT usaha B), diperbaiki, 22/22: agenda 001/002/003 tanpa loncat, duplikat nomor surat (beda huruf besar/spasi) dan usulan ditolak tidak memakai nomor, taut otomatis (Siti 100%), ragu (Andi Pratama/Andi Wijaya untuk "Andi") menyimpan dua kandidat, tanpa kandidat untuk PT, tanggal tidak sah null, taut manual admin, pihak usaha lain ditolak, staf/usaha lain tidak membaca dan tidak mengubah |
| Regresi Nomor Sakti setelah ambil_nomor dipecah ke app.terbit_nomor | nomor_sakti 23/23; uji konkuren 200 paralel lagi: 200 berhasil, 0 ganda, 0 hilang (1,9 dtk) |
| e2e surat.spec (lokal, desktop) | lulus: dua usulan dokumen.surat disetujui di Feed ("Masuk agenda surat 00n/AG/2026"), /app/surat menampilkan taut otomatis 100% dan dua kandidat saat ragu, pilih kandidat = "(dipilih manual)", status selesai + catatan, saringan status; axe 390/1440 terang/gelap tanpa pelanggaran serius; foto diperiksa |
| get_advisors | hanya WARN definer untuk authenticated (pola RPC yang diterima, peran diperiksa di dalam lewat app.peran_aktif) |

Batas yang diketahui: e2e memasukkan usulan berbentuk hasil Lempar langsung (tanpa membaca surat lewat model, supaya tanpa token AI); jalur Lempar ke usulan dokumen.surat sudah ada sejak F0-06 dan diuji eval-lempar.
