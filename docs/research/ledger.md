# Ledger: jurnal kaku, periode terkunci, posting idempoten (F4-04)

Ditulis 1 Nov 2026. Dasar pembukuan Nadi untuk invoice, mutasi bank, gaji, dan akuntan lepas (P06, P13, P16). Prinsipnya: angka yang sudah dibukukan tidak bisa diam-diam berubah; salah dibetulkan dengan jurnal balik, bukan dengan mengedit.

## Sumber (diakses 1 Nov 2026)
- PostgreSQL CREATE TRIGGER (https://www.postgresql.org/docs/current/sql-createtrigger.html): constraint trigger harus `AFTER ROW`; bisa `DEFERRABLE INITIALLY DEFERRED` sehingga dijalankan di akhir transaksi; diharapkan melempar galat bila aturan dilanggar; `WHEN` dievaluasi langsung, bukan ditunda; `OR REPLACE` tidak didukung untuk constraint trigger.

## Keputusan
1. **Tabel**: `akun` (bagan akun per usaha: kode, nama, golongan aset|kewajiban|modal|pendapatan|beban, saldo normal), `jurnal` (kepala: tanggal, keterangan, sumber, sumber_id, kunci_idempoten, dibuat_oleh, dibalik_oleh), `jurnal_baris` (jurnal, akun, debit, kredit, keterangan). Setiap baris: tepat satu dari debit/kredit > 0 (CHECK), nilai dalam rupiah bulat (bigint).
2. **Seimbang mustahil dilanggar**: constraint trigger `AFTER INSERT OR UPDATE OR DELETE ON jurnal_baris ... DEFERRABLE INITIALLY DEFERRED FOR EACH ROW` memeriksa di akhir transaksi bahwa total debit = total kredit untuk jurnal yang tersentuh dan jurnal punya minimal dua baris. Penulisan hanya lewat RPC `posting_jurnal(kepala, baris[])` yang menyisipkan kepala dan semua baris dalam satu transaksi.
3. **Tidak bisa diedit**: UPDATE/DELETE pada `jurnal` dan `jurnal_baris` ditolak trigger (kecuali menandai `dibalik_oleh`). Koreksi = RPC `balik_jurnal(id, alasan)` yang membuat jurnal lawan dengan debit dan kredit ditukar.
4. **Periode terkunci**: `periode_buku (perusahaan, bulan, terkunci_at, terkunci_oleh)`; trigger menolak jurnal bertanggal di bulan terkunci. Mengunci hanya pemilik atau akuntan; membuka kunci tercatat di audit dengan alasan.
5. **Posting idempoten**: `kunci_idempoten` unik per usaha (mis. `invoice:<id>:terbit`, `slip:<id>:setuju`). `posting_jurnal` dengan kunci yang sudah ada mengembalikan id jurnal lama tanpa membuat jurnal baru (`INSERT ... ON CONFLICT DO NOTHING` lalu SELECT), sehingga pengiriman ulang dari Feed, cron, atau MCP aman.
6. RLS: baca pemilik/admin/akuntan; staf tidak. Semua tulis lewat RPC SECURITY DEFINER.

## Kriteria terima (antrean)
Jurnal tidak seimbang mustahil (tes); posting ulang idempoten. Ditambah: jurnal di periode terkunci ditolak; UPDATE langsung ditolak; balik_jurnal menghasilkan saldo nol untuk pasangan jurnal itu.
