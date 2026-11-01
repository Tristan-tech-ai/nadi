# Hasil uji F4-04 Ledger (1 Nov 2026)

Rencana: docs/quality/rencana-uji-f4-04.md. Rancangan: docs/research/ledger.md.

| Butir rencana | Hasil |
|---|---|
| Sidik migrasi = database | 20261101020000_ledger bd9a1c92, 020100_ledger_jaga 94ecb2d4, 020200_ledger_indeks e63e010d (67 migrasi) |
| 1. Seimbang mustahil dilanggar | (a) posting_jurnal timpang ditolak 23514 "tidak seimbang" dan tidak tertinggal; (b) INSERT langsung ke jurnal_baris oleh authenticated ditolak hak; (c) satu baris ditolak 23514 "dua baris". Kendali: dengan trigger jurnal_baris_seimbang dimatikan di transaksi uji, jurnal timpang LOLOS, jadi tes (a) memang bergantung pada trigger |
| 2. Idempoten | kunci sama dua kali: id sama, 1 jurnal. scripts/uji-jurnal-idempoten.ts 20 panggilan serentak: 20 berhasil, 1 id, baru 1, tersimpan 1 (0,5 dtk) |
| 3. Tidak bisa diedit | UPDATE jurnal dan jurnal_baris ditolak 42501 bahkan oleh pemilik tabel; hapus dicek lewat struktur trigger (BEFORE DELETE OR UPDATE di kedua tabel) karena penjaga loop menolak SQL penghapus data walau di transaksi yang dibatalkan. balik_jurnal membuat jurnal lawan, saldo akun tersentuh kembali nol (1-100=0, 6-900=0), idempoten, jurnal balik tidak dibalik lagi |
| 4. Periode terkunci | bulan berjalan menurut zona usaha (Asia/Jayapura) tidak bisa dikunci; admin ditolak, akuntan mengunci; jurnal di bulan terkunci ditolak 55000; buka kunci butuh alasan dan tercatat di audit_log; jurnal balik selalu bertanggal hari ini (lihat DECISIONS) |
| 5. Rupiah bulat bigint | pecahan ditolak 22023; CHECK tepat satu dari debit/kredit > 0 |
| 6. RLS | akuntan membaca, staf 0 dan tidak bisa posting, usaha lain 0 dan tidak bisa membalik, akuntan dicabut dengan JWT lama 0, anon ditolak |
| 7. Bagan akun bawaan | 17 akun sebagai data per usaha (bawaan=true) dengan nama sehari-hari, istilah akuntansi sebagai keterangan kedua; dokumen tidak mengklaim sesuai standar mana pun |
| 8. Regresi dan advisor | kebijakan/fungsi berklaim (Q-21/Q-23) 0; advisor keamanan hanya WARN definer untuk authenticated; advisor performa menemukan FK (perusahaan_id, jurnal_id) tanpa indeks penutup, diperbaiki migrasi 020200 |

Bug yang ditemukan tes (34/36 pertama): app.jaga_jurnal membaca old.dibalik_oleh dalam satu syarat AND dengan tg_table_name; PL/pgSQL tidak berhenti lebih awal, sehingga UPDATE jurnal_baris ditolak dengan galat 42703 yang salah. Diperbaiki migrasi 020100. Satu kesalahan tes (urutan teks pg_get_triggerdef) juga dibetulkan.

Belum: layar daftar jurnal dan kunci bulan (dipakai penuh di F4-05/F4-07/F4-08).
