# Rencana verifikasi loop untuk F4-01 (Nomor Sakti)

Ditulis 1 Nov 2026 (tick 209), sebelum F4-01 dikirim ke agen. Rancangan: docs/research/nomor-sakti.md.

## Lingkup
Lapisan data dan fungsi saja:
- tabel penomor dan templat per jenis dokumen;
- RPC ambil nomor dan RPC batal nomor;
- fungsi murni penyusun nomor dari templat (TypeScript, untuk pratinjau);
- tes.

Layar pengaturan templat dan pemakaian di surat menjadi bagian F4-02. Invoice di F4-05 juga memakai RPC yang sama.

## Yang diperiksa loop sebelum `done F4-01`
1. **Sidik migrasi = database.** Penghitung TIDAK memakai sequence: `grep -i "nextval\|sequence"` di migrasi hanya boleh muncul di komentar alasan.
2. **Uji konkuren 200 permintaan paralel:**
   - dijalankan dari Node (Promise.all ke RPC lewat supabase-js dengan akun uji) atau pgbench;
   - hasilnya 200 nomor unik 1..200, 0 ganda, 0 loncat;
   - skrip uji ada di repo (scripts/ atau e2e), dijalankan loop sendiri, dan keluarannya dicatat.
3. **Transaksi batal di tengah tidak meninggalkan lubang:** tes SQL mengambil nomor di blok yang di-rollback, lalu nomor berikutnya tetap n+1.
4. **Nomor batal tetap tercatat** berstatus batal dengan alasan, tidak dipakai ulang, dan tidak dihapus.
5. **Templat:**
   - `{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}` menjadi `012/WRG/SK/XI/2026`;
   - reset bulanan bila memuat `{bulan}` atau `{bulan_romawi}`, tahunan bila hanya `{tahun}`/`{tahun2}`, tidak pernah reset bila tanpa token waktu;
   - bulan dan tahun dihitung di **zona usaha** (app.hari_ini/app.zona, pelajaran Q-24/Q-26). Uji di batas bulan untuk usaha Asia/Jayapura.
   - Vitest untuk penyusun TypeScript dan tes SQL untuk penyusun SQL harus menghasilkan string yang sama untuk tabel contoh yang sama.
6. **Hak:** ambil nomor oleh anggota aktif dengan peran yang diizinkan, lewat app.peran_aktif() (bukan app.prn/app.pengelola). Isolasi tenant: usaha lain tidak bisa mengambil atau melihat nomor. Anon ditolak.
7. **Regresi:** isolasi_tenant, jwt_cabut_q21, klaim_fungsi_q23 gagal=[]; gate LULUS; CI success; get_advisors tanpa temuan baru selain pola RPC definer yang sudah diterima.
