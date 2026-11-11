-- X-21 (temuan tes Q-21 dan Q-23 di Supabase lokal, 11 Nov 2026): 18 kebijakan baca yang dibuat setelah Q-21/Q-23 hanya
-- bersandar pada klaim JWT (app.pid(), app.pengelola()), sehingga anggota yang dicabut atau diturunkan masih bisa membaca
-- data usaha sampai tokennya kedaluwarsa (docs/quality/jwt-setelah-cabut.md, docs/quality/klaim-di-fungsi.md). Kebijakan
-- dibuat ulang dengan syarat keanggotaan aktif dari tabel anggota (app.anggota_aktif), dan public.flow_runs memakai peran
-- aktif alih-alih klaim prn. Isi lain kebijakan tidak berubah. Tes: supabase/tests/jwt_cabut_q21.test.sql,
-- supabase/tests/klaim_fungsi_q23.test.sql, dan tes modul masing-masing.

-- Pengelola (pemilik/admin) saja: app.pengelola() membaca prn dari JWT, diganti peran aktif.
drop policy ai_draft_baca_pengelola on public.ai_draft;
create policy ai_draft_baca_pengelola on public.ai_draft for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy ask_log_baca on public.ask_log;
create policy ask_log_baca on public.ask_log for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy flow_baca on public.flow;
create policy flow_baca on public.flow for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy flow_run_baca on public.flow_run;
create policy flow_run_baca on public.flow_run for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy flow_tertunda_baca on public.flow_tertunda;
create policy flow_tertunda_baca on public.flow_tertunda for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy flow_webhook_baca on public.flow_webhook;
create policy flow_webhook_baca on public.flow_webhook for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));
drop policy pindah_akun_baca on public.pindah_akun;
create policy pindah_akun_baca on public.pindah_akun for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin'])));

-- Semua anggota aktif.
drop policy bidang_kustom_baca on public.bidang_kustom;
create policy bidang_kustom_baca on public.bidang_kustom for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
drop policy kategori_klaim_baca on public.kategori_klaim;
create policy kategori_klaim_baca on public.kategori_klaim for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
drop policy uang_harian_baca on public.uang_harian;
create policy uang_harian_baca on public.uang_harian for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
-- kurs umum (perusahaan_id null) tetap terbaca semua pengguna masuk; kurs usaha hanya anggota aktif usaha itu
drop policy fx_rate_baca on public.fx_rate;
create policy fx_rate_baca on public.fx_rate for select to authenticated
  using (perusahaan_id is null or (perusahaan_id = (select app.pid()) and (select app.anggota_aktif())));
drop policy survei_isi_baca on public.survei_isi;
create policy survei_isi_baca on public.survei_isi for select to authenticated
  using (perusahaan_id = (select app.pid()) and user_id = (select auth.uid()) and (select app.anggota_aktif()));
drop policy serah_butir_baca_ilmu_sendiri on public.serah_butir;
create policy serah_butir_baca_ilmu_sendiri on public.serah_butir for select to authenticated
  using (jenis = 'ilmu' and perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and (app.butir_ilmu_saya(id)).id is not null);

-- Kinerja dan kursus: aturan kerahasiaan app.boleh_kinerja tetap, ditambah keanggotaan aktif.
drop policy perf_goal_baca on public.perf_goal;
create policy perf_goal_baca on public.perf_goal for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and app.boleh_kinerja(orang_id));
drop policy idp_item_baca on public.idp_item;
create policy idp_item_baca on public.idp_item for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and app.boleh_kinerja(orang_id));
drop policy review_result_baca on public.review_result;
create policy review_result_baca on public.review_result for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and app.boleh_kinerja(orang_id, false));
drop policy course_attempt_baca on public.course_attempt;
create policy course_attempt_baca on public.course_attempt for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and app.boleh_kinerja(orang_id));
drop policy certificate_baca on public.certificate;
create policy certificate_baca on public.certificate for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()) and app.boleh_kinerja(orang_id));

-- Riwayat jalan alur: peran aktif, bukan klaim prn.
create or replace function public.flow_runs(p_flow uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'catatan', r.catatan, 'at', r.at,
      'webhook', (select jsonb_agg(jsonb_build_object('url', w.url, 'kode', h.status_code, 'galat', h.error_msg)) from public.flow_webhook w
                   left join net._http_response h on h.id = w.request_id where w.run_id = r.id)) order by r.at desc), '[]')
    from (select * from public.flow_run where flow_id = p_flow and perusahaan_id = app.pid() and app.anggota_aktif(array['pemilik', 'admin'])
           order by at desc limit 20) r
$$;
