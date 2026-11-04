-- Tes wawancara keluar (F3-07D): hanya pemilik membuat tautan, token disimpan sebagai hash, anon membuka dengan token (tanpa isi
-- paket), kirim sekali, validasi panjang/kosong, jawaban hanya dibaca pemilik (admin, staf, usaha lain tidak). Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uadm uuid := gen_random_uuid(); pa uuid; pb uuid;
  ka text; kb text; kadm text; ks text; o_sari uuid; u_sari uuid; bh uuid; tok text; r jsonb; n int;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (uadm, 'adm@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Keluar A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Keluar B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  kadm := json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Keluar') returning id into o_sari;
  perform public.buat_akun_staf(o_sari, '123456');
  select user_id into u_sari from public.orang where id = o_sari;
  ks := json_build_object('sub', u_sari, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  r := public.catat_berhenti(o_sari, current_date, current_date + 30, 'mundur', gen_random_uuid());
  execute 'reset role';
  select id into bh from public.berhenti where orang_id = o_sari;
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uadm, 'admin');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kadm, true);
  begin perform public.buat_tautan_keluar(bh); perform pg_temp.cek('admin tidak membuat tautan', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak membuat tautan', true); end;
  perform set_config('request.jwt.claims', ka, true);
  tok := public.buat_tautan_keluar(bh);
  perform pg_temp.cek('token berawalan nmw_', tok like 'nmw_%', tok);
  execute 'reset role';
  perform pg_temp.cek('token tidak disimpan polos', not exists (select 1 from public.wawancara_keluar where token_hash = tok) and exists (select 1 from public.wawancara_keluar where token_hash = app.hash_token(tok)));

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  r := public.buka_wawancara_keluar(tok);
  perform pg_temp.cek('anon membuka dengan token', r ->> 'nama' = 'Sari Keluar' and r ->> 'usaha' = 'Warung Keluar A' and not (r ->> 'sudah')::boolean, r::text);
  perform pg_temp.cek('pembukaan tanpa isi paket', not (r ? 'jawaban') and not (r ? 'berhenti_id'));
  begin perform public.buka_wawancara_keluar('nmw_salah'); perform pg_temp.cek('token salah ditolak', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('token salah ditolak', true); end;
  begin perform public.kirim_wawancara_keluar(tok, '', ' ', null); perform pg_temp.cek('semua kosong ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('semua kosong ditolak', true); end;
  begin perform public.kirim_wawancara_keluar(tok, repeat('x', 1001), null, null); perform pg_temp.cek('terlalu panjang ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('terlalu panjang ditolak', true); end;
  perform pg_temp.cek('anon tidak membaca tabel', not has_table_privilege('anon', 'public.wawancara_keluar', 'select'));
  perform public.kirim_wawancara_keluar(tok, 'Rekan yang saling bantu', 'Jadwal malam berturut-turut', 'Jadwal dibagi lebih awal');
  begin perform public.kirim_wawancara_keluar(tok, 'lagi', null, null); perform pg_temp.cek('kirim kedua ditolak', false);
  exception when sqlstate '23505' then perform pg_temp.cek('kirim kedua ditolak', true); end;
  perform pg_temp.cek('setelah dijawab ditandai sudah', (public.buka_wawancara_keluar(tok) ->> 'sudah')::boolean);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.wawancara_keluar where jawaban ->> 'berat' = 'Jadwal malam berturut-turut';
  perform pg_temp.cek('pemilik membaca jawaban', n = 1);
  begin perform public.buat_tautan_keluar(bh); perform pg_temp.cek('tautan baru setelah dijawab ditolak', false);
  exception when sqlstate '23505' then perform pg_temp.cek('tautan baru setelah dijawab ditolak', true); end;
  perform set_config('request.jwt.claims', kadm, true);
  perform pg_temp.cek('admin tidak membaca jawaban', not exists (select 1 from public.wawancara_keluar));
  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf tidak membaca jawaban', not exists (select 1 from public.wawancara_keluar));
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak membaca', not exists (select 1 from public.wawancara_keluar));
  begin perform public.buat_tautan_keluar(bh); perform pg_temp.cek('usaha lain tidak membuat tautan', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak membuat tautan', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'wawancara_keluar: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
