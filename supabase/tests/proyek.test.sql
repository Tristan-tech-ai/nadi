-- Tes W-07D proyek (supabase/migrations/20261105088000_proyek.sql): RAB per akun beban/pendapatan, realisasi hanya dari jurnal bertag
-- proyek itu, selisih, jam kerja sendiri dan oleh pengelola, batas 24 jam/hari dan tanggal, perkiraan biaya tenaga 1/173 hanya untuk
-- pemilik/admin, staf tidak melihat laporan dan hanya melihat jamnya sendiri, isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid; o_lain uuid;
  d1 uuid; d2 uuid; j1 jsonb; j2 jsonb; j3 jsonb; r jsonb; v_hari date;
begin
  begin
    insert into auth.users (id, email) values (ua, 'pj.a@uji.local'), (ub, 'pj.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Kontraktor Uji Proyek', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Proyek', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tukang Budi') returning id into o_s;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tukang Lain') returning id into o_lain;
    perform public.buat_akun_staf(o_s, '121212');
    d1 := public.save_dimension('proyek', 'Renovasi Ruko A');
    d2 := public.save_dimension('proyek', 'Pagar Rumah B');
    perform public.ensure_chart();
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o_s, pa, '{"pokok": 3460000}');
    j1 := app.posting_jurnal(pa, jsonb_build_object('tanggal', v_hari, 'keterangan', 'Semen dan bata ruko A', 'sumber', 'manual', 'kunci_idempoten', 'uji-pj-1'),
      '[{"akun": "6-900", "debit": 4000000}, {"akun": "1-100", "kredit": 4000000}]', ua);
    j2 := app.posting_jurnal(pa, jsonb_build_object('tanggal', v_hari, 'keterangan', 'Termin 1 ruko A', 'sumber', 'manual', 'kunci_idempoten', 'uji-pj-2'),
      '[{"akun": "1-100", "debit": 6000000}, {"akun": "4-100", "kredit": 6000000}]', ua);
    j3 := app.posting_jurnal(pa, jsonb_build_object('tanggal', v_hari, 'keterangan', 'Bensin kantor', 'sumber', 'manual', 'kunci_idempoten', 'uji-pj-3'),
      '[{"akun": "6-900", "debit": 500000}, {"akun": "1-100", "kredit": 500000}]', ua);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.set_project_budget(d1, '6-900', 10000000, 'Material');
    perform public.set_project_budget(d1, '4-100', 15000000, 'Nilai kontrak');
    begin perform public.set_project_budget(d1, '1-100', 1000, null); perform pg_temp.cek('akun kas ditolak sebagai RAB', false);
    exception when sqlstate '22023' then perform pg_temp.cek('akun kas ditolak sebagai RAB', true); end;
    perform public.tag_journal((j1 ->> 'id')::uuid, d1);
    perform public.tag_journal((j2 ->> 'id')::uuid, d1);
    perform public.tag_journal((j3 ->> 'id')::uuid, d2);
    r := public.project_report(d1);
    perform pg_temp.cek('beban: anggaran 10 jt, realisasi 4 jt (jurnal proyek lain tidak ikut)', (r ->> 'beban_anggaran')::bigint = 10000000 and (r ->> 'beban_realisasi')::bigint = 4000000, r::text);
    perform pg_temp.cek('pendapatan: kontrak 15 jt, termin masuk 6 jt', (r ->> 'pendapatan_anggaran')::bigint = 15000000 and (r ->> 'pendapatan_realisasi')::bigint = 6000000);
    perform pg_temp.cek('selisih baris 6-900 = 6 jt', (select (e ->> 'selisih')::bigint from jsonb_array_elements(r -> 'baris') e where e ->> 'kode' = '6-900') = 6000000);
    perform pg_temp.cek('proyek B: realisasi tanpa anggaran tetap tampil 500 rb', (public.project_report(d2) ->> 'beban_realisasi')::bigint = 500000);

    -- Jam kerja.
    perform set_config('request.jwt.claims', ks, true);
    perform public.log_project_hours(d1, v_hari, 8, 'Pasang bata');
    begin perform public.log_project_hours(d1, v_hari, 1, null, o_lain); perform pg_temp.cek('staf tidak mencatat jam orang lain', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak mencatat jam orang lain', true); end;
    begin perform public.log_project_hours(d1, v_hari + 1, 2); perform pg_temp.cek('jam besok ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('jam besok ditolak', true); end;
    begin perform public.project_report(d1); perform pg_temp.cek('staf tidak melihat laporan proyek', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak melihat laporan proyek', true); end;
    perform set_config('request.jwt.claims', ka, true);
    perform public.log_project_hours(d1, v_hari, 3, 'Lembur cor', o_s);
    perform public.log_project_hours(d1, v_hari, 2, null, o_lain);
    begin perform public.log_project_hours(d2, v_hari, 14, null, o_s); perform pg_temp.cek('lebih dari 24 jam sehari ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('lebih dari 24 jam sehari ditolak', true); end;
    r := public.project_report(d1);
    perform pg_temp.cek('jam: Budi 11, total 13', (select (e ->> 'jam')::numeric from jsonb_array_elements(r -> 'jam') e where (e ->> 'orang')::uuid = o_s) = 11
      and (r ->> 'total_jam')::numeric = 13, r::text);
    perform pg_temp.cek('perkiraan biaya tenaga Budi = 11 x 3.460.000 / 173 = 220.000', (select (e ->> 'biaya')::numeric from jsonb_array_elements(r -> 'jam') e where (e ->> 'orang')::uuid = o_s) = 220000);
    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf hanya melihat jamnya sendiri', (select count(*) from public.project_time) = 2 and (select count(*) from public.project_budget) = 0);
    perform pg_temp.cek('staf mendapat daftar proyek aktif lewat RPC, tabel dimensi tetap tertutup', jsonb_array_length(public.active_projects()) = 2 and (select count(*) from public.dimension) = 0);

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat RAB dan jam', (select count(*) from public.project_budget) = 0 and (select count(*) from public.project_time) = 0);
    perform pg_temp.cek('usaha lain: daftar proyek kosong', jsonb_array_length(public.active_projects()) = 0);
    begin perform public.set_project_budget(d1, '6-900', 1, null); perform pg_temp.cek('usaha lain tidak mengubah RAB A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak mengubah RAB A', true); end;
    begin perform public.project_report(d1); perform pg_temp.cek('usaha lain tidak membaca laporan A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak membaca laporan A', true); end;
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
