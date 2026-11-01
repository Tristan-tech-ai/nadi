# Hasil uji F4-02 Surat dari kalimat, QR verifikasi, PDF (1 Nov 2026)

Rancangan: docs/research/surat-keluar.md.

| Butir | Hasil |
|---|---|
| Pengurai kalimat apps/web/src/lib/surat/kalimat.ts | vitest merah (modul belum ada) lalu 12/12: contoh PLAN "SK mutasi Budi ke cabang Denpasar mulai 1 Desember", surat tugas (tujuan, keperluan, selama 3 hari, besok), keterangan kerja, nama depan sama = dua kandidat tanpa menebak, tanggal lewat = tahun depan, 31 Februari ditolak, isian kurang disebut |
| Migrasi 20261101024000_surat_keluar | sidik 33f2c484 = database (68 migrasi) |
| Tes SQL supabase/tests/surat_keluar.test.sql | merah (tabel belum ada), lalu galat tes sendiri (subkueri dibaca sebagai anon), lalu 23/23: draf tanpa nomor, terbit Nomor Sakti + kode 12 huruf, tidak bisa diubah setelah terbit, verifikasi anon asli/kode diubah satu huruf ditolak/huruf kecil berspasi diterima, batal beralasan ikut membatalkan nomor dan nomor berikutnya 002, staf/usaha lain/anon ditolak |
| e2e surat-keluar.spec (lokal, desktop) | lulus: kalimat jadi isian (jenis, orang, tujuan, 1 Desember), simpan draf, terbitkan, lembar cetak; page.pdf = 1 halaman 595 x 842 pt (A4) memuat nomor, nama, dan alamat /v/kode; verifikasi tanpa akun asli, kode palsu "tidak terdaftar", setelah batal "sudah dibatalkan"; axe 390/1440 terang/gelap untuk daftar, lembar cetak, verifikasi |
| Temuan axe | tombol "Terbitkan dan beri nomor" ber-aria-label yang tidak memuat teks terlihat (label-content-name-mismatch), diperbaiki |
| get_advisors | WARN anon definer untuk verifikasi_surat (disengaja, lihat DECISIONS); sisanya pola RPC authenticated yang diterima |

Aturan cetak baru di globals.css: saat dicetak token warna selalu terang (tinta gelap di kertas), juga berlaku untuk slip gaji.
Belum: e-Sign dan e-Meterai (penyedia resmi berbayar), kalimat bebas lewat model AI.
