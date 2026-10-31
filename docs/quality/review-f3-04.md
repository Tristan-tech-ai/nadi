# Verifikasi loop F3-04 (Peta Organisasi Nyata)

1 Nov 2026, tick 170-171, terhadap docs/quality/rencana-uji-f3-04.md. Commit agen 63539e9, d275ae6, fc81283; perbaikan loop bcdb1f1 (F3-04B).

1. **Sidik**: peta_organisasi berkas = database = 52bbe2d1268c283f763a1636f67d30a2; peta_kalimat (F3-04B) = f6c8edc27ab476683cccfc9d5840b3fe; 53 migrasi.
2. **Tes SQL** (dijalankan agen pembantu terpisah, isi berkas apa adanya): sebelum F3-04B peta_organisasi 47/47, jwt_cabut_q21 17/17, kpi 40/40, izin_otopilot 26/26; sesudah F3-04B dengan teks baru: peta_organisasi HASIL_TES 47 | gagal=[].
3. **Hak**: peta_organisasi dan usulkan_pasang_topi memakai app.peran_aktif(); 'app.prn' hanya muncul di dua komentar migrasi (dicek grep). putuskan_usulan diganti agen: diff terhadap versi kpi hanya `app.prn()` -> `app.peran_aktif()` (2 tempat) dan cabang baru `orang.topi`.
4. **Angka**: persen dari poin kerja selesai; jendela 28 hari bergulir di zona usaha; ambang < 3 kerja untuk topi dan orang.
5. **Lintas topi**: teks "lintas topi" di graf (label di garis), tabel (kolom Catatan) dan daftar HP; stabilo kunyit + ikon.
6. **Graf**: tabel padanan "isi yang sama dengan graf"; graf aria-hidden dengan tombol pilihan di panel; axe (laporan agen) tanpa pelanggaran serius.
7. **Usulan**: untuk_peran {pemilik}, idempoten dengan kunci klien, tidak mengubah pakai_topi sebelum disetujui; e2e memeriksa usulan muncul di Feed pemilik.
8. **Foto** (scratchpad/f3-04-foto): dilihat 1440 terang dan 390 gelap. HP berupa daftar per topi, satu tombol utama, tidak menyalahkan.
9. **Produksi**: Vercel READY 2c4a1c0; e2e peta.spec produksi lulus 23,1 dtk (teks lama) lalu 16,5 dtk setelah F3-04B (teks baru dibaca dari SQL produksi).

## Temuan dan perbaikan (F3-04B)
Kalimat kepala "Dewi mengerjakan 75% urusan kasir walau topinya pelayan" salah arah: 75% adalah bagian kerja Dewi sendiri, sedangkan bagian Dewi di topi kasir 46% (tabel di layar yang sama). Asal kesalahan: contoh kalimat di docs/design/peta-organisasi.md yang ditulis loop. Diperbaiki menjadi "75% kerja Dewi 4 minggu terakhir adalah urusan kasir, walau topinya pelayan." di app.peta_isi dan penjelasan usulkan_pasang_topi (migrasi 20261101011000_peta_kalimat.sql, hanya teks); tes SQL, e2e, fixture vitest, dan rancangan ikut diperbarui. Kalimat sisi klien (peta.ts) sudah benar arahnya.

## Catatan
- putuskan_usulan cabang orang.topi memakai current_date (UTC server) untuk pakai_topi.mulai; masuk cakupan Q-24 (zona).
- Keadaan memuat dan galat ada di kode tetapi tidak diuji e2e.
