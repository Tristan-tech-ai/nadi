-- Advisor performa 1 Nov 2026 (unindexed_foreign_keys): enam FK tanpa indeks penutup, termasuk persetujuan_lembur dari F3-06.
-- pakai_topi.orang_id dipakai join beban_orang; orang.user_id dipakai app.orang_saya di setiap kebijakan baca staf.
create index if not exists persetujuan_lembur_perusahaan_id_idx on public.persetujuan_lembur (perusahaan_id);
create index if not exists serah_butir_perusahaan_id_idx on public.serah_butir (perusahaan_id);
create index if not exists pakai_topi_orang_id_idx on public.pakai_topi (orang_id);
create index if not exists orang_user_id_idx on public.orang (user_id);
create index if not exists ekstraktor_perusahaan_id_idx on public.ekstraktor (perusahaan_id);
create index if not exists rahasia_tempat_perusahaan_id_idx on app.rahasia_tempat (perusahaan_id);
