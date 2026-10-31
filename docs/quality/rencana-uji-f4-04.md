# Rencana verifikasi loop untuk F4-04 (Ledger)

Ditulis 1 Nov 2026 (tick 210), sebelum F4-04 dikerjakan. Rancangan: docs/research/ledger.md (constraint trigger AFTER ROW DEFERRABLE INITIALLY DEFERRED, jurnal tidak bisa diedit, balik_jurnal, periode terkunci, kunci idempoten).

## Yang diperiksa loop sebelum `done F4-04`
1. **Seimbang mustahil dilanggar.** Tes SQL mencoba ketiga jalan berikut, dan semuanya harus gagal di akhir transaksi dengan pesan yang jelas:
   - (a) RPC posting_jurnal dengan debit tidak sama dengan kredit;
   - (b) INSERT langsung ke jurnal_baris oleh authenticated (harus ditolak hak);
   - (c) jurnal dengan satu baris saja.

   Merah dulu: constraint trigger dimatikan di salinan uji, lalu tes (a) harus lolos (membuktikan tes benar-benar bergantung pada trigger). Setelah itu dinyalakan kembali.
2. **Idempoten.** posting_jurnal dua kali dengan kunci_idempoten sama mengembalikan id jurnal yang sama, jumlah jurnal tetap 1. Juga diuji dari Node dengan 20 panggilan paralel kunci sama: tepat 1 jurnal.
3. **Tidak bisa diedit.** UPDATE dan DELETE langsung pada jurnal/jurnal_baris ditolak, kecuali penandaan dibalik_oleh lewat RPC. balik_jurnal(id, alasan) membuat jurnal lawan. Saldo akun yang tersentuh pasangan jurnal itu kembali ke nilai sebelum jurnal asli.
4. **Periode terkunci.**
   - Jurnal bertanggal di bulan terkunci ditolak, dan bulan dihitung di **zona usaha** (app.hari_ini/app.zona, pelajaran Q-24/Q-26).
   - Mengunci hanya pemilik atau akuntan lewat app.peran_aktif(). Membuka kunci butuh alasan dan tercatat di audit_log.
   - balik_jurnal untuk jurnal di bulan terkunci ditolak atau diarahkan ke bulan berjalan. Pilihan ini dicatat di DECISIONS dengan alasan.
5. **Nilai rupiah bulat bigint;** CHECK tepat satu dari debit/kredit > 0 per baris.
6. **RLS:**
   - baca pemilik/admin/akuntan, staf tidak;
   - anggota dicabut dengan JWT lama tidak bisa membaca (pola Q-23);
   - isolasi tenant.
7. **Bagan akun bawaan** adalah pilihan Nadi, bukan isi SAK EMKM. SAK EMKM (IAI) mengatur penyajian laporan, bukan daftar akun. Kode dan nama akun bawaan ditulis sebagai data per usaha yang bisa diubah, dan dokumen tidak mengklaim bahwa bagan itu "sesuai SAK EMKM" sebelum teks resmi dibaca.
8. **Regresi:** isolasi_tenant, jwt_cabut_q21, klaim_fungsi_q23 gagal=[]; gate LULUS; CI success; get_advisors tanpa temuan baru selain pola RPC definer yang diterima. Sidik migrasi = database.
9. **Bila ada layar** (daftar jurnal, kunci periode): foto 390/1440 terang/gelap, axe; angka lewat komponen Rupiah; keterangan istilah akuntansi menjadi keterangan kedua (VOICE: "Tagihan belum dibayar (piutang)").
