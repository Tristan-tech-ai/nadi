-- F4-04 lanjutan: get_advisors (unindexed_foreign_keys) menandai FK jurnal_baris (perusahaan_id, jurnal_id) tanpa indeks penutup.
-- Indeks jurnal_id tetap dipakai trigger keseimbangan (saring per jurnal saja).
create index jurnal_baris_perusahaan_jurnal_idx on public.jurnal_baris (perusahaan_id, jurnal_id);
