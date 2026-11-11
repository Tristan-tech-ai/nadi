-- Indeks untuk foreign key tabel baru X-04..X-13 (temuan get_advisors performa unindexed_foreign_keys, 11 Nov 2026), sama
-- dengan pola migrasi indeks_fk: hapus atau ubah baris induk (orang, pelanggan, template, usaha) tidak memindai seluruh tabel.
create index if not exists kerja_butir_perusahaan on public.kerja_butir (perusahaan_id);
create index if not exists kerja_hasil_oleh on public.kerja_hasil (oleh);
create index if not exists kerja_hasil_perusahaan on public.kerja_hasil (perusahaan_id);
create index if not exists kerja_pelaksana_orang_fk on public.kerja_pelaksana (orang_id);
create index if not exists mod_log_mod on public.mod_log (perusahaan_id, mod_id);
create index if not exists proyek_info_klien on public.proyek_info (klien);
create index if not exists proyek_info_perusahaan on public.proyek_info (perusahaan_id);
create index if not exists proyek_info_pic on public.proyek_info (pic);
create index if not exists proyek_info_template on public.proyek_info (template_id);
create index if not exists proyek_invoice_dimension on public.proyek_invoice (dimension_id);
create index if not exists proyek_periode_perusahaan on public.proyek_periode (perusahaan_id);
create index if not exists proyek_template_perusahaan on public.proyek_template (perusahaan_id);
create index if not exists proyek_tim_orang on public.proyek_tim (orang_id);
