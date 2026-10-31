# Rancangan SQL jadwal shift (F3-06)

Ditulis 1 Nov 2026 dari skema yang ada (public.lembur F1-05B, public.tempat, public.topi, perusahaan.pengaturan dan zona_waktu, app.awal_minggu F3-02). Aturan hukum: docs/research/shift-f3-06.md; layar: docs/design/jadwal-shift.md. Belum ada tabel jadwal di 49 migrasi (dicek dengan grep).

## Tabel
**public.shift** (satu baris = satu shift satu orang; libur = tidak ada baris, bukan baris kosong)
- id uuid7, perusahaan_id, orang_id (fk orang, cascade), tanggal date (hari MULAI di zona usaha; shift lewat tengah malam tetap satu baris), mulai time, selesai time (selesai <= mulai berarti esok hari), istirahat_menit int (0-240), topi_id null, tempat_id null, kunci_klien uuid (idempoten, unik per perusahaan), dibuat_oleh, dibuat_at, diubah_at.
- menit_kerja = durasi - istirahat dihitung fungsi. mulai_at/selesai_at timestamptz DISIMPAN (diisi RPC dari (tanggal + mulai)::timestamp at time zone perusahaan.zona_waktu), lihat bagian Diputuskan.
- unique (orang_id, tanggal, mulai): satu orang boleh dua shift terpisah sehari (split shift F&B), tetapi tidak dua yang mulai di jam sama. Tumpang tindih ditolak oleh RPC dan exclusion constraint gist (lihat bagian Diputuskan).
- RLS: baca pemilik/admin/akuntan semua; staf hanya baris app.orang_saya(). Tulis hanya lewat RPC (insert/update/delete dicabut dari authenticated).

**public.persetujuan_lembur** (Pasal 78 ayat (1) huruf a: lembur butuh persetujuan pekerja)
- id, perusahaan_id, shift_id (fk, cascade), orang_id, menit_lembur int, status 'menunggu'|'setuju'|'tidak', dijawab_at, dibuat_at. Unik per shift.
- Staf menjawab lewat RPC jawab_lembur(id, setuju boolean). "Tidak bisa" tanpa alasan.

**Pola usaha**: perusahaan.pengaturan->>'pola_kerja' in ('6_hari','5_hari'), bawaan '6_hari'; pengaturan->>'jam_diatur_pk' boolean (Pasal 21 ayat (4)). Tanpa kolom baru di perusahaan.

## RPC
- **simpan_shift(p_orang, p_tanggal, p_mulai, p_selesai, p_istirahat, p_topi, p_tempat, p_kunci) -> jsonb** pemilik/admin. Menolak: tumpang tindih dengan shift lain orang itu; lembur > 4 jam/hari atau > 18 jam/minggu (54000, pesan sama dengan catat_lembur). Mengembalikan {id, sudah, peringatan[]} dengan kode peringatan dari app.cek_shift. Bila menit melebihi jam normal hari itu, membuat/memperbarui persetujuan_lembur 'menunggu'.
- **hapus_shift(p_id)**: menghapus baris jadwal (bukan data historis: jadwal masa depan). Supaya taat PENJAGA "tidak ada SQL yang menghapus data tanpa cadangan", penghapusan dicatat ke audit_log dengan isi baris lama (cadangan), dan hanya untuk tanggal >= hari ini zona usaha. Shift lampau tidak bisa dihapus.
- **salin_jadwal(p_dari date, p_ke date) -> int** salin minggu; tidak menimpa shift yang sudah ada di minggu tujuan; idempoten.
- **jadwal_minggu(p_mulai date default null) -> jsonb** pemilik/admin/akuntan: orang x hari + total jam + peringatan. **jadwal_saya(p_mulai)** staf: miliknya saja + persetujuan menunggu.
- **app.jam_jadwal(p_pid, p_mulai) -> table(orang_id, menit)**: dipakai F3-02 app.beban_orang menggantikan jam 40 tetap (jam = menit/60; orang tanpa jadwal tetap 40 dan layar tetap mengatakannya) dan F3-03 "hadir sesuai jadwal".
- **app.cek_shift(...)** murni (sql immutable): kode peringatan 'lewat_jam_harian', 'lewat_40_minggu', 'tanpa_istirahat' (> 4 jam terus-menerus, istirahat < 30), 'kurang_libur' (pola 6: < 1 hari; pola 5: < 2), 'malam_umur_18' (shift menyentuh 23.00-07.00 dan umur < 18 dari orang.data.tanggal_lahir bila ada). Batas per hari: 7 jam (pola 6) / 8 jam (pola 5) dari PP 35/2021 Pasal 21 ayat (2), sudah terverifikasi.

## Hubungan ke fitur lain
- **Beban (F3-02)**: app.beban_orang memakai app.jam_jadwal; jam_sama_rata menjadi false bila minimal satu orang punya jadwal minggu itu. Tes bagi_adil harus diperbarui (jam 40 hanya fallback).
- **KPI hadir (F3-03)**: hadir_sesuai_jadwal = shift dengan absen.masuk dalam [mulai_at - 30 menit, mulai_at + 15 menit] / shift yang sudah lewat, dikurangi hari izin disetujui (pengajuan_izin mulai..selesai). Absen di luar shift ditandai di laporan, bukan ditolak.
- **Lembur (F1-05B)**: jam lembur dari jadwal yang DISETUJUI pekerja bisa diusulkan ke public.lembur (usulan untuk pemilik, bukan otomatis), karena lembur dibayar dari jam nyata, bukan rencana.

## Tes SQL wajib (supabase/tests/shift.test.sql)
Isolasi tenant (usaha B tidak melihat/menulis shift A); staf hanya jadwalnya; staf tidak bisa simpan_shift (42501); anon 42501; shift lewat tengah malam (22.00-06.00) dihitung 8 jam di tanggal mulai; zona Asia/Jayapura vs Asia/Jakarta; tumpang tindih ditolak; lembur 5 jam sehari ditolak 54000, 19 jam seminggu ditolak; peringatan tanpa istirahat dan kurang libur muncul; persetujuan lembur dibuat dan hanya orang itu yang bisa menjawab; hapus shift lampau ditolak, hapus shift depan tercatat di audit_log; kunci klien sama tidak membuat dua baris; salin_jadwal idempoten.

## Diputuskan (dicek 1 Nov 2026)
- **btree_gist**: tersedia di proyek (pg_available_extensions: default_version 1.7, belum terpasang; btree_gin 1.3 sudah terpasang). Keputusan: pasang `create extension if not exists btree_gist with schema extensions` di migrasi shift, dan simpan **mulai_at, selesai_at timestamptz sebagai kolom biasa yang diisi RPC** (bukan generated column: konversi `at time zone` dengan zona per usaha tidak dijamin immutable, dan generated column wajib immutable). Sabuk kedua: `exclude using gist (orang_id with =, tstzrange(mulai_at, selesai_at) with &&)`. Bila zona usaha diubah kemudian, shift lama tetap pada instan aslinya (benar: shift sudah dijalani pada jam itu). Bila pemasangan ekstensi ditolak advisor (extension_in_public), pemeriksaan di RPC + tes tetap jadi pertahanan utama.
- **Cadangan sebelum hapus**: public.audit_log (graf_usaha baris 273-312) punya kolom sebelum/sesudah jsonb dan fungsi trigger app.catat_audit() yang menyalin baris lama; dipasang di orang dan pakai_topi. Keputusan: `create trigger audit_shift after insert or update or delete on public.shift for each row execute function app.catat_audit()`, sehingga hapus_shift otomatis meninggalkan salinan baris lama tanpa kode tambahan. Batas jujur: audit_log disimpan 180 hari (mode_hemat, pg_partman retention), jadi cadangan jadwal yang dihapus hilang setelah 180 hari; dapat diterima karena hanya jadwal depan yang boleh dihapus dan shift yang sudah dijalani tidak pernah dihapus.
- **Umur < 18**: peringatan malam hanya bila orang.data memuat tanggal_lahir; tidak ada kolom baru.

## Di luar rancangan ini (masih bagian F3-06)
Judul F3-06 juga memuat penyusun jadwal otomatis (solver), ramalan kebutuhan, dan tukar shift, dengan kriteria "memenuhi semua batasan pada 3 skenario uji" dan "keadilan shift malam terukur". Skema di atas adalah fondasinya (batasan sebagai fungsi app.cek_shift yang bisa dipakai solver), tetapi solver, ramalan, dan tukar shift belum dirancang; perlu riset tersendiri sebelum dibangun.
