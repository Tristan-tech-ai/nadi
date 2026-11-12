-- Tes X-13B (supabase/migrations/20261112140000_kelola_kerja_saya.sql): kelola_kerja_saya membuka daftar rekan dan topi hanya untuk
-- pemilik/admin dan pemegang peran kustom kerja.kelola, tanpa data gaji, hanya orang aktif usaha sendiri; anon tidak bisa memanggil.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; k1 text; k2 text; o1 uuid; o2 uuid; o3 uuid; ob uuid; peran uuid; r jsonb;
begin
  insert into auth.users (id, email) values (ua, 'kk-a@uji.local'), (ub, 'kk-b@uji.local'), (u1, 'kk-1@uji.local'), (u2, 'kk-2@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Agensi Koordinator A', 'kantor');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Agensi Koordinator B', 'kantor');
  execute 'reset role';
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Koordinator Rina', array['karyawan'], u1) returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Staf Budi', array['karyawan'], u2) returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, status) values (pa, 'Mantan Dodi', array['karyawan'], 'nonaktif') returning id into o3;
  insert into public.orang (perusahaan_id, nama, jenis) values (pb, 'Orang Usaha B', array['karyawan']) returning id into ob;
  insert into public.orang_rahasia (orang_id, perusahaan_id, rekening_akhir, gaji) values (o2, pa, '9876', '{"pokok": 5000000}');
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, u1, 'staf', o1), (pa, u2, 'staf', o2);
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  k1 := json_build_object('sub', u1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k2 := json_build_object('sub', u2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', ka, true);
  r := public.kelola_kerja_saya();
  perform pg_temp.cek('pemilik boleh mengelola dan melihat 2 orang aktif', (r ->> 'kelola')::boolean and jsonb_array_length(r -> 'orang') = 2, r::text);
  perform pg_temp.cek('orang nonaktif dan usaha lain tidak ikut', not (r::text like '%Mantan Dodi%') and not (r::text like '%Orang Usaha B%'), r::text);
  perform pg_temp.cek('topi aktif usaha ini ikut (paket kantor)', jsonb_typeof(r -> 'topi') = 'array');

  perform set_config('request.jwt.claims', k1, true);
  r := public.kelola_kerja_saya();
  perform pg_temp.cek('staf tanpa izin: kelola false, tanpa daftar', not (r ->> 'kelola')::boolean and jsonb_array_length(r -> 'orang') = 0 and jsonb_array_length(r -> 'topi') = 0, r::text);

  perform set_config('request.jwt.claims', ka, true);
  peran := public.save_custom_role(null, 'Koordinator kerja', array['kerja.kelola']);
  perform public.assign_custom_role(u1, peran);

  perform set_config('request.jwt.claims', k1, true);
  r := public.kelola_kerja_saya();
  perform pg_temp.cek('staf dengan kerja.kelola boleh mengelola dan melihat rekan aktif', (r ->> 'kelola')::boolean and jsonb_array_length(r -> 'orang') = 2
    and r::text like '%Staf Budi%', r::text);
  perform pg_temp.cek('tanpa gaji, rekening, atau kolom selain id dan nama', not (r::text like '%5000000%') and not (r::text like '%9876%')
    and (select bool_and((select count(*) from jsonb_object_keys(x)) = 2) from jsonb_array_elements(r -> 'orang') x), r::text);
  perform pg_temp.cek('RLS orang tetap: koordinator tidak membaca baris orang lain langsung', (select count(*) from public.orang where id = o2) = 0);
  perform public.buat_kerja('Siapkan materi klien', null, o2, null, null);
  perform pg_temp.cek('koordinator membuat kerja untuk rekan', exists (select 1 from public.kerja where judul = 'Siapkan materi klien'));

  perform set_config('request.jwt.claims', k2, true);
  r := public.kelola_kerja_saya();
  perform pg_temp.cek('staf lain tanpa izin tetap false', not (r ->> 'kelola')::boolean);

  perform set_config('request.jwt.claims', kb, true);
  r := public.kelola_kerja_saya();
  perform pg_temp.cek('pemilik usaha B hanya melihat orang usaha B', jsonb_array_length(r -> 'orang') = 1 and r::text like '%Orang Usaha B%', r::text);

  -- Peran dicabut: izin hilang seketika.
  perform set_config('request.jwt.claims', ka, true);
  perform public.assign_custom_role(u1, null);
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('peran kustom dicabut: kelola false', not (public.kelola_kerja_saya() ->> 'kelola')::boolean);
  execute 'reset role';

  execute 'set local role anon';
  begin perform public.kelola_kerja_saya(); perform pg_temp.cek('anon tidak bisa memanggil', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa memanggil', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
