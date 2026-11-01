-- Tes F4-08 undang akuntan: pemilik menambah lewat email (jawaban sama untuk email terdaftar atau tidak), akun staf sintetis
-- ditolak, admin yang sudah ada tidak diturunkan, cabut = nonaktif (baris tetap), tambah lagi mengaktifkan kembali; akuntan
-- yang dicabut tidak lagi melihat usaha itu di ruang_akuntan; selain pemilik ditolak.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kd text; x text; y text;
begin
  begin
    insert into auth.users (id, email) values (ua, 'pemilik@uji.local'), (ub, 'Akuntan.B@Uji.local'), (ud, 'admin@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Undang A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Kantor B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (pa, ud, 'admin', true);
    execute 'set local role authenticated';

    perform set_config('request.jwt.claims', ka, true);
    x := public.tambah_akuntan('  akuntan.b@uji.LOCAL ');
    y := public.tambah_akuntan('tidak.ada@uji.local');
    perform pg_temp.cek('jawaban sama untuk email terdaftar dan tidak', x = y, x);
    perform pg_temp.cek('akuntan B tercatat aktif (email tanpa beda huruf besar)', (public.daftar_akuntan() -> 0 ->> 'email') = 'Akuntan.B@Uji.local'
      and (public.daftar_akuntan() -> 0 ->> 'aktif')::boolean and jsonb_array_length(public.daftar_akuntan()) = 1, public.daftar_akuntan()::text);
    begin perform public.tambah_akuntan('ABCDEF-S001@staf.nadi.local'); perform pg_temp.cek('akun staf sintetis ditolak', false);
    exception when others then perform pg_temp.cek('akun staf sintetis ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.tambah_akuntan('bukan email'); perform pg_temp.cek('bukan email ditolak', false);
    exception when others then perform pg_temp.cek('bukan email ditolak', sqlstate = '22023', sqlerrm); end;
    perform public.tambah_akuntan('admin@uji.local');
    execute 'reset role';
    perform pg_temp.cek('admin yang sudah ada tidak diturunkan jadi akuntan', (select peran from public.anggota where perusahaan_id = pa and user_id = ud) = 'admin');
    execute 'set local role authenticated';

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('akuntan B melihat Warung Undang A di ruang_akuntan', exists (select 1 from jsonb_array_elements(public.ruang_akuntan()) e
      where e ->> 'nama' = 'Warung Undang A' and e ->> 'peran' = 'akuntan'));
    begin perform public.tambah_akuntan('admin@uji.local'); perform pg_temp.cek('B (pemilik di usahanya) tidak menambah ke usaha A', true);
    exception when others then perform pg_temp.cek('B (pemilik di usahanya) tidak menambah ke usaha A', false, sqlerrm); end;
    execute 'reset role';
    perform pg_temp.cek('tambahan B hanya ke usahanya sendiri', not exists (select 1 from public.anggota where perusahaan_id = pa and user_id = ud and peran = 'akuntan')
      and exists (select 1 from public.anggota where perusahaan_id = pb and user_id = ud and peran = 'akuntan'));
    execute 'set local role authenticated';

    perform set_config('request.jwt.claims', ka, true);
    perform public.cabut_akuntan(ub);
    perform pg_temp.cek('cabut: baris tetap, nonaktif', (public.daftar_akuntan() -> 0 ->> 'aktif')::boolean = false and jsonb_array_length(public.daftar_akuntan()) = 1);
    begin perform public.cabut_akuntan(ub); perform pg_temp.cek('cabut dua kali: tidak ditemukan', false);
    exception when others then perform pg_temp.cek('cabut dua kali: tidak ditemukan', sqlstate = 'P0002', sqlerrm); end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('akuntan yang dicabut tidak lagi melihat usaha A', not exists (select 1 from jsonb_array_elements(public.ruang_akuntan()) e where e ->> 'nama' = 'Warung Undang A'));
    perform set_config('request.jwt.claims', ka, true);
    perform public.tambah_akuntan('akuntan.b@uji.local');
    perform pg_temp.cek('ditambah lagi: aktif kembali', (public.daftar_akuntan() -> 0 ->> 'aktif')::boolean);

    perform set_config('request.jwt.claims', kd, true);
    begin perform public.tambah_akuntan('x@uji.local'); perform pg_temp.cek('admin tidak menambah akuntan', false);
    exception when others then perform pg_temp.cek('admin tidak menambah akuntan', sqlstate = '42501', sqlerrm); end;
    begin perform public.daftar_akuntan(); perform pg_temp.cek('admin tidak melihat daftar akuntan', false);
    exception when others then perform pg_temp.cek('admin tidak melihat daftar akuntan', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.tambah_akuntan('x@uji.local'); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
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
