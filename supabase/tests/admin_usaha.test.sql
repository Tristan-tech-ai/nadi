-- Tes ADMIN-01: add_admin, list_admins, remove_admin hanya untuk pemilik (lewat app.peran_aktif, bukan klaim), lewat email akun
-- Nadi yang ada, tanpa membocorkan apakah email terdaftar, akun staf ditolak, pemilik tidak bisa menurunkan dirinya, usaha lain
-- terpisah, mencabut menonaktifkan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ux uuid := gen_random_uuid();
  pa uuid; px uuid; ka text; kb text; kc text; kx text; r jsonb; m text; n int;
begin
  begin
    perform pg_temp.cek('tiga fungsi ada dan memeriksa peran lewat peran_aktif',
      (select count(*) = 3 and bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.add_admin(text)'::regprocedure, 'public.list_admins()'::regprocedure, 'public.remove_admin(uuid)'::regprocedure)));
    perform pg_temp.cek('anon tidak bisa memanggil', not has_function_privilege('anon', 'public.add_admin(text)', 'execute')
      and not has_function_privilege('anon', 'public.list_admins()', 'execute') and not has_function_privilege('anon', 'public.remove_admin(uuid)', 'execute'));

    insert into auth.users (id, email) values (ua, 'pemilik-a@uji.local'), (ub, 'calon-admin@uji.local'), (uc, 'akuntan-c@uji.local'), (ux, 'pemilik-x@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Admin', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ux, 'role', 'authenticated')::text, true);
    px := public.buat_perusahaan('Toko Uji Admin X', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uc, 'akuntan');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kc := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    kx := json_build_object('sub', ux, 'role', 'authenticated', 'app_metadata', json_build_object('pid', px, 'prn', 'pemilik'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    m := public.add_admin('  Calon-Admin@uji.local ');
    perform pg_temp.cek('pemilik menambah admin lewat email (huruf besar dan spasi diabaikan)',
      exists (select 1 from public.anggota where perusahaan_id = pa and user_id = ub and peran = 'admin' and aktif), m);
    perform pg_temp.cek('jawaban sama untuk email yang tidak terdaftar', public.add_admin('belum-daftar@uji.local') = m);
    perform public.add_admin('pemilik-a@uji.local');
    perform pg_temp.cek('pemilik tidak menurunkan dirinya sendiri', exists (select 1 from public.anggota where perusahaan_id = pa and user_id = ua and peran = 'pemilik' and aktif));
    perform public.add_admin('akuntan-c@uji.local');
    perform pg_temp.cek('akuntan usaha ini bisa dijadikan admin', exists (select 1 from public.anggota where perusahaan_id = pa and user_id = uc and peran = 'admin'));
    begin
      perform public.add_admin('0001.x@staf.nadi.local');
      perform pg_temp.cek('akun staf tanpa email ditolak', false);
    exception when others then perform pg_temp.cek('akun staf tanpa email ditolak', sqlstate = '22023', sqlstate);
    end;
    r := public.list_admins();
    perform pg_temp.cek('daftar admin memuat dua admin aktif', jsonb_array_length(r) = 2
      and (select bool_and((e ->> 'aktif')::boolean) from jsonb_array_elements(r) e), r::text);
    perform public.remove_admin(uc);
    perform pg_temp.cek('mencabut menonaktifkan, tidak menghapus', exists (select 1 from public.anggota where perusahaan_id = pa and user_id = uc and peran = 'admin' and not aktif));
    begin
      perform public.remove_admin(uc);
      perform pg_temp.cek('mencabut dua kali: tidak ditemukan', false);
    exception when others then perform pg_temp.cek('mencabut dua kali: tidak ditemukan', sqlstate = 'P0002', sqlstate);
    end;
    begin
      perform public.remove_admin(ua);
      perform pg_temp.cek('pemilik tidak bisa dicabut lewat remove_admin', false);
    exception when others then perform pg_temp.cek('pemilik tidak bisa dicabut lewat remove_admin', sqlstate = 'P0002', sqlstate);
    end;

    -- Bukan pemilik.
    perform set_config('request.jwt.claims', kb, true);
    begin
      perform public.add_admin('akuntan-c@uji.local');
      perform pg_temp.cek('admin tidak bisa menambah admin', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak bisa menambah admin', true);
    end;
    begin
      perform public.remove_admin(ub);
      perform pg_temp.cek('admin tidak bisa mencabut admin', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak bisa mencabut admin', true);
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
    begin
      perform public.list_admins();
      perform pg_temp.cek('klaim prn=pemilik tanpa keanggotaan pemilik ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('klaim prn=pemilik tanpa keanggotaan pemilik ditolak', true);
    end;

    -- Usaha lain.
    perform set_config('request.jwt.claims', kx, true);
    perform pg_temp.cek('usaha lain tidak melihat admin usaha A', jsonb_array_length(public.list_admins()) = 0);
    begin
      perform public.remove_admin(ub);
      perform pg_temp.cek('pemilik usaha lain tidak bisa mencabut admin usaha A', false);
    exception when others then perform pg_temp.cek('pemilik usaha lain tidak bisa mencabut admin usaha A', sqlstate = 'P0002', sqlstate);
    end;
    execute 'reset role';
    perform pg_temp.cek('admin usaha A tetap aktif', exists (select 1 from public.anggota where perusahaan_id = pa and user_id = ub and peran = 'admin' and aktif));
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
