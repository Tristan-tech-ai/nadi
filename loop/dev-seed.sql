-- Konfigurasi untuk Supabase LOKAL saja (mode tanpa commit). Di produksi baris ini diisi langsung, bukan lewat migrasi,
-- jadi database lokal yang hanya berisi migrasi tidak punya harga AI, model, dan biaya platform; tes SQL yang
-- menghitung biaya atau memanggil rute model lalu gagal. Nilai harga dan biaya disalin dari produksi (11 Nov 2026,
-- sumbernya tertulis di dalam nilai). ID model sengaja diganti nama pengganti: ID model hidup di konfigurasi produksi,
-- tidak ditulis di repo. Dijalankan oleh sh loop/dev-db.sh setelah migrasi. Tidak menimpa baris yang sudah ada.
insert into public.konfigurasi (kunci, nilai) values
  ('model_ai', '{"ringan": "model-ringan-dev", "berat": "model-berat-dev", "ambang_naik": 0.75}'),
  ('harga_ai', '{"sumber": "halaman pricing resmi penyedia model AI", "diakses": "2026-11-03", "kurs_idr": 18148,
     "kurs_sumber": "JISDOR Bank Indonesia 3 Nov 2026", "tugas_batch": ["analis_malam"], "diskon_batch": 0.5,
     "model": {
       "model-ringan-dev": {"masuk": 0.1, "keluar": 0.5, "cache_baca": 0.01, "cache_tulis": 0.125,
                            "panjang": {"ambang": 100000, "masuk": 0.5, "keluar": 2.5, "cache_baca": 0.05, "cache_tulis": 0.625}},
       "model-berat-dev": {"masuk": 2, "keluar": 10, "cache_baca": 0.1, "cache_tulis": 2.5}}}'),
  ('biaya_platform', '{"sumber": "supabase.com/pricing (tarif lebih Pro), diakses 2026-11-03", "db_usd_gb": 0.125,
     "storage_usd_gb": 0.0213, "byte_baris_sumber": "docs/quality/kapasitas.md",
     "byte_baris": {"orang": 251, "usulan": 584, "kejadian": 338, "audit_log": 994, "slip_gaji": 1136}}')
on conflict (kunci) do nothing;

-- Usaha contoh untuk mode coba (L-03). Di produksi konfigurasi usaha_tamu menunjuk usaha sintetis Toko Bu Sari yang
-- diisi langsung; lokal dibuat versi kecil dengan id yang sama supaya /demo dan tes usaha_tamu punya data. Data sintetis.
insert into public.perusahaan (id, nama, industri, pengaturan)
select '01a1a931-28b5-7762-b90f-0a719b518da5', 'Toko Bu Sari (contoh lokal)', 'toko', '{}'::jsonb
where not exists (select 1 from public.perusahaan where id = '01a1a931-28b5-7762-b90f-0a719b518da5');
insert into public.orang (perusahaan_id, nama)
select '01a1a931-28b5-7762-b90f-0a719b518da5', n from unnest(array['Sari Wulandari', 'Rina Pratiwi', 'Dodi Saputra']) n
where not exists (select 1 from public.orang where perusahaan_id = '01a1a931-28b5-7762-b90f-0a719b518da5');
