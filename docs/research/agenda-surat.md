# Agenda surat masuk dari Lempar (F4-03)

Ditulis 1 Nov 2026. Masalah P07: surat masuk (undangan, tagihan resmi, surat dinas, SK dari induk usaha) ditumpuk di map tanpa nomor agenda; saat dicari, tidak ada yang tahu kapan diterima dan untuk siapa.

## Yang sudah ada
- baca-berkas mengenali jenis `surat` dengan bidang `nomor`, `jenis`, `tanggal`, `pihak` (supabase/functions/baca-berkas/inti.ts) dan membuat usulan `dokumen.surat` "Arsipkan ... <nomor>" di Feed.
- Nomor Sakti (F4-01, docs/research/nomor-sakti.md) memberi nomor tanpa ganda dan tanpa loncat.

## Keputusan
1. **Tabel `agenda_surat`**: perusahaan, arah (`masuk` | `keluar`), nomor_agenda (dari Nomor Sakti, templat bawaan `{no:3}/AG/{bulan_romawi}/{tahun}`, reset tahunan), nomor_surat (persis seperti tertulis), jenis, perihal, tanggal_surat, diterima_at, pengirim_teks, pihak_orang_id (tautan ke `orang`: karyawan, pemasok, pelanggan, instansi), berkas_id (bukti), status (`baru` | `ditindaklanjuti` | `selesai`), catatan.
2. **Dari Lempar**: menyetujui usulan `dokumen.surat` di Feed (putuskan_usulan) mendaftarkan surat ke agenda dalam transaksi yang sama, mengambil nomor agenda, dan menautkan berkas. Usulan menampilkan nomor agenda yang akan dipakai.
3. **Tautan ke pihak**: nama `pihak` dicocokkan ke `orang` usaha itu dengan pg_trgm (kemiripan >= 0,6 dan satu kandidat teratas yang jelas, selisih >= 0,15 dari kandidat kedua) lalu ditaut otomatis dengan keterangan "ditaut otomatis, yakin x%". Bila ragu, kartu usulan menampilkan dua kandidat teratas plus pilihan "pihak baru"; tidak pernah menebak diam-diam.
4. **Duplikat**: surat dengan nomor_surat dan pengirim yang sama di usaha yang sama tidak didaftarkan dua kali; usulan kedua menyebut "sudah tercatat sebagai agenda 012/AG/XI/2026".
5. **Layar**: /app/surat, daftar agenda per bulan dengan saringan arah dan status, pencarian nomor/perihal, tautan ke berkas asli dan halaman orang pihaknya.

## Kriteria terima (antrean)
Surat masuk terdaftar dan tertaut ke pihak. Rinci: e2e melempar surat korpus (fixtures/korpus/surat), menyetujui usulan, agenda bernomor muncul dan tertaut ke orang yang namanya cocok; tes SQL untuk duplikat, tautan otomatis vs ragu, dan isolasi usaha.
