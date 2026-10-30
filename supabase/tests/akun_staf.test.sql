-- Tes akun staf (buat_akun_staf). Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; ob uuid; r jsonb; r2 jsonb; ka text; ks text;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  pa := public.buat_perusahaan('Warung Uji A');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o1;
  perform pg_temp.cek('perusahaan baru punya kode 6 huruf', (select kode from public.perusahaan where id = pa) ~ '^[A-HJ-NP-Z2-9]{6}$');
  r := public.buat_akun_staf(o1, '123456');
  perform pg_temp.cek('akun staf dibuat dengan ID S001', r ->> 'id_staf' = 'S001');
  r2 := public.buat_akun_staf(o1, '654321');
  perform pg_temp.cek('panggilan kedua hanya mengganti PIN (ID tetap)', r2 ->> 'id_staf' = 'S001');
  begin
    perform public.buat_akun_staf(o1, '12ab');
    perform pg_temp.cek('PIN bukan 6 angka ditolak', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('PIN bukan 6 angka ditolak', true, sqlerrm); end;
  execute 'reset role';
  perform pg_temp.cek('auth.users berema il sintetis staf.nadi.local', exists (select 1 from auth.users where email = lower((r ->> 'kode') || '-s001@staf.nadi.local')));
  perform pg_temp.cek('kata sandi = PIN terbaru (bcrypt)', exists (select 1 from auth.users where email = lower((r ->> 'kode') || '-s001@staf.nadi.local') and encrypted_password = extensions.crypt('654321', encrypted_password)));
  perform pg_temp.cek('identitas email dibuat', exists (select 1 from auth.identities i join public.orang o on o.user_id = i.user_id where o.id = o1));
  perform pg_temp.cek('staf menjadi anggota berperan staf', (select a.peran from public.anggota a join public.orang o on o.user_id = a.user_id where o.id = o1) = 'staf');
  perform pg_temp.cek('klaim pid+prn staf tertulis', (select raw_app_meta_data ->> 'prn' from auth.users u join public.orang o on o.user_id = u.id where o.id = o1) = 'staf');

  -- Staf tidak bisa membuat akun staf
  ks := json_build_object('sub', (select user_id from public.orang where id = o1), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', ks, true);
  execute 'set local role authenticated';
  begin
    perform public.buat_akun_staf(o1, '111111');
    perform pg_temp.cek('staf tidak bisa membuat akun staf', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('staf tidak bisa membuat akun staf', true, sqlerrm); end;
  execute 'reset role';

  -- Pemilik B tidak bisa membuat akun untuk orang A
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  pb := public.buat_perusahaan('Toko Uji B');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  begin
    perform public.buat_akun_staf(o1, '222222');
    perform pg_temp.cek('pemilik lain tidak bisa membuat akun untuk orang A', false, 'seharusnya ditolak');
  exception when others then perform pg_temp.cek('pemilik lain tidak bisa membuat akun untuk orang A', true, sqlerrm); end;
  insert into public.orang (perusahaan_id, nama) values (pb, 'Sari') returning id into ob;
  perform pg_temp.cek('ID staf dihitung per perusahaan (B juga S001)', public.buat_akun_staf(ob, '333333') ->> 'id_staf' = 'S001');
  execute 'reset role';
  perform pg_temp.cek('kode perusahaan A dan B berbeda', (select kode from public.perusahaan where id = pa) <> (select kode from public.perusahaan where id = pb));
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
