# Verifikasi loop F3-03 (KPI dan cermin kinerja)

1 Nov 2026, tick 157, terhadap docs/quality/rencana-uji-f3-03.md. Commit agen 5bfe732, 045c561, 6419abd (ter-push di 5015321).

1. **Sidik**: berkas 20261101008000_kpi.sql = database = 3444a0fc426b978f359d879d5130d103; 51 migrasi (bersama jwt_cabut_q21).
2. **Tes SQL kpi**: dijalankan ulang oleh agen regresi terpisah (hasil dicatat di bawah setelah datang).
3. **Zona**: fungsi KPI memakai app.awal_minggu + perusahaan.zona_waktu. Satu-satunya 'Asia/Makassar' di berkas migrasi ada di putuskan_usulan cabang orang.impor (warisan, bukan KPI).
4. **putuskan_usulan diganti agen**: dibandingkan dengan versi terakhir (20261031170000_izin_otopilot.sql) lewat difflib: satu-satunya perbedaan adalah cabang baru `kpi.banding` (mencatat kejadian kpi.banding untuk kerja di usaha sendiri). Tidak ada perubahan lain.
5. **Hadir**: tampil "Belum dihitung. Hadir sesuai jadwal muncul setelah jadwal shift diisi." di staf; di tabel pemilik satu kalimat di kepala tabel. Bukan 0.
6. **Penjelasan**: "6 poin dari 3 kerja selesai: Setor kas (3 poin), Cek stok beras (2 poin), Cuci gelas (1 poin)", "Satu yang lewat: Cek stok beras (Minggu, lewat 1 jam)". Dari data SQL, tanpa model.
7. **Banding**: usulan untuk_peran {pemilik} (Q-17 terpenuhi), kunci klien idempoten (tes SQL agen). Tidak memakai token AI karena rute model hanya untuk {pemilik, admin}.
8. **Foto** (scratchpad/f3-03-foto, 16 berkas kpi-*): dilihat staf 390 terang, banding 390 gelap, pemilik 1440 gelap. Tidak menyalahkan ("1 yang lewat", bukan "kamu terlambat"); turun/naik dengan teks; satu kolom angka di HP, tabel buku kas di desktop; tanpa tiga kartu sama besar.
9. **Produksi**: Vercel READY 5015321; e2e kpi.spec terhadap produksi lulus (27,4 dtk, folder keluaran terpisah).

## Catatan
- Komentar app.kpi_rata menulis "minimal 3 orang punya kerja di ukuran itu", padahal n untuk poin dan lintas adalah jumlah orang dengan kerja selesai (lintas dirata-rata atas mereka); hanya tepat tenggat memakai n bertenggat sendiri. Perilaku setara ambang beban_saya; komentar sedikit melebihkan. Tidak diubah.
- Satu kegagalan e2e lokal agen (baris 146, jumlah usulan banding bukan 1) terjadi saat loop menjalankan spec lain dengan akun uji A secara bersamaan; usaha aktif melekat di akun (STATE: jebakan pindah_perusahaan paralel). Dua putaran berikutnya lulus. Dugaan, belum dibuktikan.
- Belum ada: kolom "tinjauan pemilik" di cermin (butuh tempat simpan); dicatat sebagai sisa, bukan bagian kriteria terima.
