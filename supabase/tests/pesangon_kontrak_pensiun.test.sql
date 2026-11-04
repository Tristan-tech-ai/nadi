-- Tes F4-09B: aturan kompensasi.pkwt terverifikasi (PP 35/2021 Pasal 15-17), iuran dana pensiun per orang (Pasal 58) hanya
-- diisi dan dibaca pemilik, ikut bahan cadangan_pesangon, validasi nilai, usaha lain terpisah. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; o2 uuid; ob uuid;
  ka text; kb text; kd text; r jsonb; a jsonb;
begin
  select nilai into a from public.aturan_bertanggal where kunci = 'kompensasi.pkwt' and terverifikasi;
  perform pg_temp.cek('aturan kompensasi.pkwt terverifikasi (pembagi 12, minimal 1 bulan, mikro kecil kesepakatan)',
    (a ->> 'pembagi_bulan')::int = 12 and (a ->> 'minimal_bulan')::int = 1 and (a ->> 'mikro_kecil_kesepakatan')::boolean, coalesce(a::text, 'tidak ada'));
  perform pg_temp.cek('sumber menyebut Pasal 16 dan 17', (select sumber ~ 'Pasal 16' and sumber ~ 'Pasal 17' from public.aturan_bertanggal where kunci = 'kompensasi.pkwt'));
  perform pg_temp.cek('anon tidak bisa mengisi iuran', not has_function_privilege('anon', 'public.atur_iuran_pensiun(uuid,bigint)', 'execute')
    and not has_table_privilege('authenticated', 'public.iuran_pensiun', 'insert'));

  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (ud, 'd@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji Pensiun', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji Pensiun B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Sari', array['karyawan'], '{"mulai":"2022-09-01"}') returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Rina', array['karyawan'], '{"mulai":"2026-02-01","kontrak_selesai":"2027-01-31"}') returning id into o2;
  perform set_config('request.jwt.claims', kb, true);
  insert into public.orang (perusahaan_id, nama, jenis) values (pb, 'Orang B', array['karyawan']) returning id into ob;
  execute 'reset role';
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('pemilik mengisi iuran', public.atur_iuran_pensiun(o1, 10000000) = 10000000);
  perform public.atur_iuran_pensiun(o1, 12000000);
  r := public.cadangan_pesangon();
  perform pg_temp.cek('bahan cadangan membawa iuran per orang (nilai terbaru)',
    (select (e ->> 'iuran_pensiun')::bigint from jsonb_array_elements(r -> 'orang') e where e ->> 'id' = o1::text) = 12000000, (r -> 'orang')::text);
  perform pg_temp.cek('orang tanpa iuran = null', (select e -> 'iuran_pensiun' from jsonb_array_elements(r -> 'orang') e where e ->> 'id' = o2::text) = 'null'::jsonb);
  perform pg_temp.cek('bahan cadangan membawa aturan kompensasi', (r -> 'kompensasi' -> 'nilai' ->> 'pembagi_bulan')::int = 12);
  perform pg_temp.cek('kontrak_selesai ikut bahan', (select e ->> 'kontrak_selesai' from jsonb_array_elements(r -> 'orang') e where e ->> 'id' = o2::text) = '2027-01-31');
  perform pg_temp.cek('pemilik membaca tabel iuran', (select count(*) from public.iuran_pensiun) = 1);
  begin perform public.atur_iuran_pensiun(o1, -1); perform pg_temp.cek('iuran negatif ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('iuran negatif ditolak', true); end;
  begin perform public.atur_iuran_pensiun(ob, 1000); perform pg_temp.cek('orang usaha lain ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('orang usaha lain ditolak', true); end;

  perform set_config('request.jwt.claims', kd, true);
  begin perform public.atur_iuran_pensiun(o1, 1); perform pg_temp.cek('admin tidak mengisi iuran', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak mengisi iuran', true); end;
  perform pg_temp.cek('admin tidak membaca iuran', not exists (select 1 from public.iuran_pensiun));
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak membaca iuran', not exists (select 1 from public.iuran_pensiun));
  execute 'reset role';
  perform pg_temp.cek('perubahan iuran tercatat di audit', exists (select 1 from public.audit_log where tabel = 'iuran_pensiun' and perusahaan_id = pa));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'pesangon_kontrak_pensiun: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
