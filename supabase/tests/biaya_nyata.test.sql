-- Tes M-27 biaya nyata (supabase/migrations/20261105091000_biaya_nyata.sql): angka public.nadi_cost sama dengan sumber operator
-- app.biaya_usaha, contoh tangan dari harga konfigurasi, berkas bulan ini dihitung, bulan lalu terpisah, staf mendapat null,
-- usaha lain tidak melihat angka usaha ini. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid;
  r jsonb; src jsonb; v_hari date; kurs numeric; harga jsonb; usd_tangan numeric; m1 text; m2 text;
begin
  begin
    insert into auth.users (id, email) values (ua, 'by.a@uji.local'), (ub, 'by.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Biaya', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Biaya', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '530001');
    execute 'reset role';
    v_hari := app.hari_ini(pa);
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;
    select nilai into harga from public.konfigurasi where kunci = 'harga_ai';
    kurs := (harga ->> 'kurs_idr')::numeric;
    -- Nama model diambil dari konfigurasi (tidak ditulis di kode): termurah = m1, termahal = m2.
    select k into m1 from jsonb_object_keys(harga -> 'model') k order by (harga -> 'model' -> k ->> 'masuk')::numeric limit 1;
    select k into m2 from jsonb_object_keys(harga -> 'model') k order by (harga -> 'model' -> k ->> 'masuk')::numeric desc limit 1;
    -- Pemakaian bulan ini: model ringan 40.000 masuk + 20.000 keluar + 50.000 cache baca; model berat 10.000 masuk + 2.000 keluar.
    insert into public.pemakaian_ai (perusahaan_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis, dibuat_at) values
      (pa, 'uji_biaya', m1, 40000, 20000, 50000, 0, now()),
      (pa, 'uji_biaya', m2, 10000, 2000, 0, 0, now()),
      (pa, 'uji_biaya', m1, 60000, 0, 0, 0, now() - interval '62 days'),
      (pb, 'uji_biaya', m2, 999999, 999999, 0, 0, now());
    insert into public.berkas (perusahaan_id, jalur, dibuat_at) values (pa, pa || '/uji1', now()), (pa, pa || '/uji2', now()), (pa, pa || '/lama', now() - interval '62 days');
    usd_tangan := (40000 * (harga -> 'model' -> m1 ->> 'masuk')::numeric + 20000 * (harga -> 'model' -> m1 ->> 'keluar')::numeric
      + 50000 * (harga -> 'model' -> m1 ->> 'cache_baca')::numeric
      + 10000 * (harga -> 'model' -> m2 ->> 'masuk')::numeric + 2000 * (harga -> 'model' -> m2 ->> 'keluar')::numeric) / 1000000;
    src := app.biaya_usaha(pa, v_hari);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.nadi_cost();
    perform pg_temp.cek('angka sama dengan sumber app.biaya_usaha', (r ->> 'usd')::numeric = (src ->> 'usd')::numeric and (r ->> 'usd_ai')::numeric = (src -> 'ai' ->> 'usd')::numeric
      and (r ->> 'storage_byte')::bigint = (src ->> 'storage_byte')::bigint and (r ->> 'db_byte')::bigint = (src ->> 'db_byte')::bigint and r ->> 'bulan' = src ->> 'bulan', r::text || ' / ' || src::text);
    perform pg_temp.cek('biaya AI = contoh tangan dari harga konfigurasi', (r ->> 'usd_ai')::numeric = round(usd_tangan, 6), (r ->> 'usd_ai') || ' vs ' || usd_tangan);
    perform pg_temp.cek('token bulan ini 122.000 (cache 50.000), 2 panggilan, bulan lalu tidak ikut', (r ->> 'token')::bigint = 122000 and (r ->> 'token_cache')::bigint = 50000
      and (r ->> 'panggilan')::int = 2, r::text);
    perform pg_temp.cek('berkas bulan ini 2', (r ->> 'berkas')::int = 2, r::text);
    perform pg_temp.cek('rupiah = usd x kurs konfigurasi', (r ->> 'idr')::numeric = round((src ->> 'usd')::numeric * kurs, 2) and (r ->> 'kurs_idr')::numeric = kurs, r::text);
    r := public.nadi_cost((v_hari - 62));
    perform pg_temp.cek('bulan lalu: 60.000 token dan 1 berkas', (r ->> 'token')::bigint = 60000 and (r ->> 'berkas')::int = 1, r::text);

    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf tidak melihat biaya', public.nadi_cost() is null);
    perform set_config('request.jwt.claims', kb, true);
    r := public.nadi_cost();
    perform pg_temp.cek('usaha lain hanya melihat angkanya sendiri', (r ->> 'token')::bigint = 1999998 and (r ->> 'berkas')::int = 0, r::text);
    begin perform app.biaya_usaha(pa, v_hari); perform pg_temp.cek('fungsi operator tetap tertutup untuk klien', false);
    exception when sqlstate '42501' then perform pg_temp.cek('fungsi operator tetap tertutup untuk klien', true); end;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    begin perform public.nadi_cost(); perform pg_temp.cek('anon tidak memanggil nadi_cost', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon tidak memanggil nadi_cost', true); end;
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
