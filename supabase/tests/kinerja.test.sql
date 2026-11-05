-- Tes M-13 kinerja (supabase/migrations/20261105089000_kinerja.sql): siklus review diri + atasan + rekan, hanya penilai yang mengisi,
-- skor 1-5 per kompetensi, rekan tampil sebagai rata-rata baru bila >= 2, skor usulan berbobot, kalibrasi 9-box hanya pemilik/admin,
-- RAHASIA: yang dinilai, rekan, dan staf lain tidak melihat nilai; atasan hanya bawahan langsungnya; tujuan dan IDP; isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  o_budi uuid; o_sari uuid; o_dewi uuid; o_eko uuid; o_fani uuid; k_budi text; k_sari text; k_dewi text; k_eko text; k_fani text;
  cy uuid; e_diri uuid; e_atasan uuid; e_dewi uuid; e_eko uuid; r jsonb; v_hari date; g uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'kn.a@uji.local'), (ub, 'kn.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Kinerja', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Kinerja', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Eko') returning id into o_eko;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Fani') returning id into o_fani;
    perform public.buat_akun_staf(o_budi, '510001'); perform public.buat_akun_staf(o_sari, '510002'); perform public.buat_akun_staf(o_dewi, '510003');
    perform public.buat_akun_staf(o_eko, '510004'); perform public.buat_akun_staf(o_fani, '510005');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    insert into public.profil_kerja (orang_id, perusahaan_id, atasan_id) values (o_budi, pa, o_sari);
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_budi from public.orang where id = o_budi;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_sari from public.orang where id = o_sari;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_dewi from public.orang where id = o_dewi;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_eko from public.orang where id = o_eko;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_fani from public.orang where id = o_fani;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', k_sari, true);
    begin perform public.create_review_cycle('Review Q4', v_hari, v_hari + 14, array['Kualitas', 'Kerja sama'], array[o_budi]); perform pg_temp.cek('staf tidak membuka siklus', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuka siklus', true); end;
    perform set_config('request.jwt.claims', ka, true);
    cy := public.create_review_cycle('Review Q4', v_hari, v_hari + 14, array['Kualitas', 'Kerja sama'], array[o_budi]);
    perform public.add_peer_reviewer(cy, o_budi, o_dewi);
    perform public.add_peer_reviewer(cy, o_budi, o_eko);
    select id into e_diri from public.review_entry where cycle_id = cy and peran = 'diri';
    select id into e_atasan from public.review_entry where cycle_id = cy and peran = 'atasan';
    select id into e_dewi from public.review_entry where cycle_id = cy and penilai_id = o_dewi;
    select id into e_eko from public.review_entry where cycle_id = cy and penilai_id = o_eko;
    perform pg_temp.cek('siklus membuat tugas diri + atasan (dari profil kerja) + 2 rekan', e_diri is not null and e_atasan is not null and e_dewi is not null and e_eko is not null);

    perform set_config('request.jwt.claims', k_budi, true);
    perform public.submit_review(e_diri, '{"Kualitas": 4, "Kerja sama": 4}', 'Target bulanan tercapai');
    begin perform public.submit_review(e_atasan, '{"Kualitas": 5, "Kerja sama": 5}', null); perform pg_temp.cek('yang dinilai tidak mengisi isian atasan', false);
    exception when sqlstate '42501' then perform pg_temp.cek('yang dinilai tidak mengisi isian atasan', true); end;
    perform set_config('request.jwt.claims', k_sari, true);
    begin perform public.submit_review(e_atasan, '{"Kualitas": 6, "Kerja sama": 4}', null); perform pg_temp.cek('skor 6 ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('skor 6 ditolak', true); end;
    begin perform public.submit_review(e_atasan, '{"Kualitas": 3}', null); perform pg_temp.cek('kompetensi kurang ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('kompetensi kurang ditolak', true); end;
    perform public.submit_review(e_atasan, '{"Kualitas": 3, "Kerja sama": 4}', 'Teliti, perlu lebih cepat');
    perform set_config('request.jwt.claims', k_dewi, true);
    perform public.submit_review(e_dewi, '{"Kualitas": 5, "Kerja sama": 5}', 'Rajin membantu');

    perform set_config('request.jwt.claims', ka, true);
    r := public.review_summary(cy);
    perform pg_temp.cek('rekan baru 1 orang: tidak ditampilkan; usulan (3,5 x 0,6 + 4 x 0,2) / 0,8 = 3,63', r -> 0 -> 'rekan' = 'null'::jsonb and (r -> 0 ->> 'usulan')::numeric = 3.63, r::text);
    perform set_config('request.jwt.claims', k_eko, true);
    perform public.submit_review(e_eko, '{"Kualitas": 3, "Kerja sama": 3}', null);
    perform set_config('request.jwt.claims', ka, true);
    r := public.review_summary(cy);
    perform pg_temp.cek('2 rekan: rata-rata 4, usulan 3,70', (r -> 0 ->> 'rekan')::numeric = 4 and (r -> 0 ->> 'usulan')::numeric = 3.70 and (r -> 0 ->> 'masuk')::int = 4, r::text);

    -- Kerahasiaan.
    perform set_config('request.jwt.claims', k_budi, true);
    perform pg_temp.cek('RAHASIA: yang dinilai hanya melihat isian dirinya sendiri', (select count(*) from public.review_entry) = 1
      and (select penilai_id from public.review_entry) = o_budi and jsonb_array_length(public.review_summary(cy)) = 0 and (select count(*) from public.review_result) = 0);
    perform set_config('request.jwt.claims', k_dewi, true);
    perform pg_temp.cek('RAHASIA: rekan hanya melihat isiannya sendiri', (select count(*) from public.review_entry) = 1 and jsonb_array_length(public.review_summary(cy)) = 0);
    perform set_config('request.jwt.claims', k_fani, true);
    perform pg_temp.cek('RAHASIA: staf lain tidak melihat apa pun', (select count(*) from public.review_entry) = 0 and jsonb_array_length(public.review_summary(cy)) = 0);
    perform set_config('request.jwt.claims', k_sari, true);
    perform pg_temp.cek('atasan langsung melihat semua isian bawahannya dan ringkasan', (select count(*) from public.review_entry) = 4 and jsonb_array_length(public.review_summary(cy)) = 1);
    begin perform public.calibrate_review(cy, o_budi, null, 3, null); perform pg_temp.cek('atasan tidak mengkalibrasi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('atasan tidak mengkalibrasi', true); end;

    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('kalibrasi dengan skor usulan 3,70 + potensi tinggi = k2p3', public.calibrate_review(cy, o_budi, null, 3, null) = 'k2p3');
    perform pg_temp.cek('kalibrasi ubah skor 4,2 = k3p3 (bintang)', public.calibrate_review(cy, o_budi, 4.2, 3, 'Naik setelah kalibrasi tim') = 'k3p3');
    perform set_config('request.jwt.claims', k_sari, true);
    perform pg_temp.cek('atasan melihat hasil kalibrasi bawahannya', (select kotak from public.review_result where orang_id = o_budi) = 'k3p3');
    perform set_config('request.jwt.claims', k_budi, true);
    perform pg_temp.cek('RAHASIA: yang dinilai tidak melihat hasil kalibrasi', (select count(*) from public.review_result) = 0);
    perform set_config('request.jwt.claims', ka, true);
    perform public.close_review_cycle(cy);
    perform set_config('request.jwt.claims', k_eko, true);
    begin perform public.submit_review(e_eko, '{"Kualitas": 4, "Kerja sama": 4}', null); perform pg_temp.cek('siklus selesai: isian terkunci', false);
    exception when sqlstate '22023' then perform pg_temp.cek('siklus selesai: isian terkunci', true); end;

    -- Tujuan dan IDP.
    perform set_config('request.jwt.claims', k_budi, true);
    g := public.save_goal(jsonb_build_object('orang', o_budi, 'judul', 'Jual 300 paket bulan ini', 'target', 300, 'satuan', 'paket', 'mulai', v_hari, 'selesai', v_hari + 30));
    perform public.save_goal(jsonb_build_object('id', g, 'progres', 120));
    perform set_config('request.jwt.claims', k_fani, true);
    begin perform public.save_goal(jsonb_build_object('orang', o_budi, 'judul', 'Target palsu', 'mulai', v_hari, 'selesai', v_hari)); perform pg_temp.cek('staf lain tidak mengatur tujuan Budi', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf lain tidak mengatur tujuan Budi', true); end;
    perform pg_temp.cek('staf lain tidak melihat tujuan Budi', (select count(*) from public.perf_goal) = 0);
    perform set_config('request.jwt.claims', k_sari, true);
    perform public.save_idp_item(jsonb_build_object('orang', o_budi, 'tujuan', 'Kursus kasir cepat', 'langkah', 'Ikut pelatihan 2 sesi', 'target', v_hari + 60));
    perform set_config('request.jwt.claims', k_budi, true);
    perform pg_temp.cek('Budi melihat tujuan (progres 120) dan IDP-nya', (select progres from public.perf_goal where id = g) = 120 and (select count(*) from public.idp_item) = 1);

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat apa pun', (select count(*) from public.review_cycle) = 0 and (select count(*) from public.review_entry) = 0
      and (select count(*) from public.perf_goal) = 0 and (select count(*) from public.idp_item) = 0);
    begin perform public.calibrate_review(cy, o_budi, 3, 2, null); perform pg_temp.cek('usaha lain tidak mengkalibrasi', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengkalibrasi', true); end;
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
