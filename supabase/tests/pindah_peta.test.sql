-- Tes T-01C (supabase/migrations/20261105103000_pindah_peta.sql): peta mulai bayangan, aktif butuh 2 kali cocok, isi peta hanya
-- bidang tetap -> judul pendek (tanpa data), klien tidak bisa menulis, usaha lain dan staf tidak melihat, staf ditolak konteks.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o uuid; v uuid; r jsonb; n int;
begin
  insert into auth.users (id, email) values (ua, 'pp.a@uji.local'), (ub, 'pp.b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Uji Peta A', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji Peta B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o;
  perform public.buat_akun_staf(o, '530103');
  execute 'reset role';
  select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o;

  insert into public.pindah_peta (perusahaan_id, sidik, format, peta) values (pa, 'a1b2c3d4', 'produk', '{"nama":"barang","harga_jual":"hrg jual"}') returning id into v;
  perform pg_temp.cek('peta baru mulai bayangan', (select status = 'bayangan' from public.pindah_peta where id = v));
  begin
    update public.pindah_peta set status = 'aktif' where id = v;
    perform pg_temp.cek('aktif tanpa 2 kali cocok ditolak', false);
  exception when check_violation then perform pg_temp.cek('aktif tanpa 2 kali cocok ditolak', true); end;
  update public.pindah_peta set bayangan_cocok = 2, status = 'aktif' where id = v;
  perform pg_temp.cek('aktif setelah 2 kali cocok', (select status = 'aktif' from public.pindah_peta where id = v));
  begin
    insert into public.pindah_peta (perusahaan_id, sidik, format, peta) values (pa, 'b1b2c3d4', 'produk', '{"rekening":"no rek"}');
    perform pg_temp.cek('bidang di luar daftar ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('bidang di luar daftar ditolak', true); end;
  begin
    insert into public.pindah_peta (perusahaan_id, sidik, format, peta) values (pa, 'c1b2c3d4', 'karyawan', '{"nama":"3201234567890001"}');
    perform pg_temp.cek('judul berisi angka panjang (data) ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('judul berisi angka panjang (data) ditolak', true); end;
  begin
    insert into public.pindah_peta (perusahaan_id, sidik, format, peta) values (pa, 'd1b2c3d4', 'akun', '{"nama":"nama"}');
    perform pg_temp.cek('format di luar daftar ditolak', false);
  exception when check_violation then perform pg_temp.cek('format di luar daftar ditolak', true); end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.pindah_peta;
  perform pg_temp.cek('pemilik A melihat petanya', n = 1, n::text);
  r := public.learn_migration_context();
  perform pg_temp.cek('konteks belajar memberi usaha sesi', (r ->> 'perusahaan_id')::uuid = pa, r::text);
  begin
    insert into public.pindah_peta (perusahaan_id, sidik, format, peta) values (pa, 'e1b2c3d4', 'produk', '{"nama":"barang"}');
    perform pg_temp.cek('klien tidak bisa menulis peta', false);
  exception when insufficient_privilege then perform pg_temp.cek('klien tidak bisa menulis peta', true); end;
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.pindah_peta;
  perform pg_temp.cek('usaha B tidak melihat peta usaha A', n = 0, n::text);
  perform set_config('request.jwt.claims', ks, true);
  select count(*) into n from public.pindah_peta;
  perform pg_temp.cek('staf tidak membaca peta', n = 0, n::text);
  begin
    r := public.learn_migration_context();
    perform pg_temp.cek('staf ditolak konteks belajar', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf ditolak konteks belajar', true); end;
  execute 'reset role';
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
