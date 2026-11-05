-- Tes U-06 fitur per jenis usaha (supabase/migrations/20261105097000_fitur_usaha.sql): pemilik menyimpan pilihan modul di
-- pengaturan.fitur tanpa menimpa kunci pengaturan lain, pilihan hanya untuk usaha sesi, staf dan anon ditolak, kode modul tak
-- dikenal ditolak, daftar modul SQL sama dengan MODUL di src/lib/fitur-usaha.ts. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid; r jsonb;
begin
  begin
    perform pg_temp.cek('daftar modul SQL = MODUL aplikasi',
      app.feature_modules() = array['kasir', 'stok', 'produksi', 'dagang_luar', 'servis', 'janji', 'proyek', 'mata', 'crm', 'layanan']);
    insert into auth.users (id, email) values (ua, 'fu.a@uji.local'), (ub, 'fu.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Fitur', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Klinik Uji Fitur', 'klinik');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
    perform public.buat_akun_staf(o_budi, '530101');
    execute 'reset role';
    update public.perusahaan set pengaturan = coalesce(pengaturan, '{}'::jsonb) || '{"catatan_uji": "tetap"}'::jsonb where id = pa;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.set_feature_module('produksi', true);
    r := public.set_feature_module('kasir', false);
    perform pg_temp.cek('pemilik menyimpan dua pilihan', r = '{"produksi": true, "kasir": false}'::jsonb, r::text);
    r := public.set_feature_module('kasir', true);
    perform pg_temp.cek('pilihan bisa dibalik', r ->> 'kasir' = 'true', r::text);
    perform pg_temp.cek('kunci pengaturan lain tetap', (select pengaturan ->> 'catatan_uji' from public.perusahaan where id = pa) = 'tetap');
    begin
      perform public.set_feature_module('gaji', false);
      perform pg_temp.cek('modul tak dikenal ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('modul tak dikenal ditolak', true); end;

    -- Usaha lain: pilihan pemilik B hanya mengubah usaha B.
    perform set_config('request.jwt.claims', kb, true);
    r := public.set_feature_module('mata', false);
    perform pg_temp.cek('pemilik B hanya mengubah usahanya', r = '{"mata": false}'::jsonb, r::text);
    perform pg_temp.cek('usaha B tidak melihat pengaturan usaha A', not exists (select 1 from public.perusahaan where id = pa));
    execute 'reset role';
    perform pg_temp.cek('usaha A tidak tersentuh B', (select pengaturan -> 'fitur' from public.perusahaan where id = pa) = '{"produksi": true, "kasir": true}'::jsonb);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.set_feature_module('kasir', false);
      perform pg_temp.cek('staf ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf ditolak', true); end;
    execute 'reset role';
    execute 'set local role anon';
    begin
      perform public.set_feature_module('kasir', false);
      perform pg_temp.cek('anon ditolak', false);
    exception when sqlstate '42501' then perform pg_temp.cek('anon ditolak', true); end;
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
