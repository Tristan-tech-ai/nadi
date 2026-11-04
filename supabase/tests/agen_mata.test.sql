-- Tes F5-04 token agen Mata: dibuat pemilik/admin (bukan staf), hanya hash disimpan, anon membaca zona usaha token saja, mencatat
-- kejadian hanya saat berubah, token salah atau dicabut ditolak, usaha lain terpisah, kolom token_hash tidak terbaca klien.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  tok text; tokb text; z jsonb; zid uuid; n int; aid uuid;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Agen A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Agen B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  perform public.simpan_zona_mata('[{"nama": "Meja 1", "jenis": "meja", "poligon": [[0,0],[0.5,0],[0.5,0.5],[0,0.5]]}, {"nama": "Antre kasir", "jenis": "antrean", "poligon": [[0.5,0.5],[1,0.5],[1,1],[0.5,1]]}]'::jsonb);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Agen') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  tok := public.buat_token_agen_mata('Kotak dapur');
  perform pg_temp.cek('token berawalan nma_', tok like 'nma_%');
  perform pg_temp.cek('klien tidak membaca token_hash', not has_column_privilege('authenticated', 'public.agen_mata', 'token_hash', 'select'));
  perform set_config('request.jwt.claims', kb, true);
  perform public.simpan_zona_mata('[{"nama": "Meja B", "jenis": "meja", "poligon": [[0,0],[1,0],[1,1],[0,1]]}]'::jsonb);
  tokb := public.buat_token_agen_mata('Kotak B');
  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform pg_temp.cek('hanya hash disimpan', not exists (select 1 from public.agen_mata where token_hash = tok) and exists (select 1 from public.agen_mata where token_hash = app.hash_token(tok)));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.buat_token_agen_mata('Kotak staf'); perform pg_temp.cek('staf tidak membuat token', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat token', true); end;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  z := public.agen_mata_zona(tok);
  perform pg_temp.cek('anon dengan token membaca zona usahanya saja', jsonb_array_length(z) = 2 and z -> 0 ->> 'nama' = 'Meja 1', z::text);
  zid := (z -> 0 ->> 'id')::uuid;
  n := public.agen_mata_catat(tok, jsonb_build_array(jsonb_build_object('zona', zid, 'status', 'terisi'), jsonb_build_object('zona', z -> 1 ->> 'id', 'jumlah', 3)));
  perform pg_temp.cek('catat dua kejadian', n = 2, n::text);
  n := public.agen_mata_catat(tok, jsonb_build_array(jsonb_build_object('zona', zid, 'status', 'terisi')));
  perform pg_temp.cek('keadaan sama tidak dicatat ulang', n = 0, n::text);
  begin perform public.agen_mata_catat(tokb, jsonb_build_array(jsonb_build_object('zona', zid, 'status', 'kosong'))); perform pg_temp.cek('token usaha lain tidak bisa mencatat zona A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('token usaha lain tidak bisa mencatat zona A', true); end;
  begin perform public.agen_mata_zona('nma_salah'); perform pg_temp.cek('token salah ditolak', false);
  exception when sqlstate '28000' then perform pg_temp.cek('token salah ditolak', true); end;
  begin perform public.agen_mata_catat(tok, jsonb_build_array(jsonb_build_object('zona', zid, 'status', 'penuh'))); perform pg_temp.cek('status tidak sah ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('status tidak sah ditolak', true); end;
  perform pg_temp.cek('anon tidak membaca tabel agen', not has_table_privilege('anon', 'public.agen_mata', 'select'));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select id into aid from public.agen_mata where nama = 'Kotak dapur';
  perform public.cabut_token_agen_mata(aid);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak melihat agen A', not exists (select 1 from public.agen_mata where id = aid));
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  begin perform public.agen_mata_catat(tok, '[]'::jsonb); perform pg_temp.cek('token dicabut ditolak', false);
  exception when sqlstate '28000' then perform pg_temp.cek('token dicabut ditolak', true); end;
  execute 'reset role';
  perform pg_temp.cek('kejadian tercatat dengan sumber mata_agen', (select count(*) from public.kejadian where perusahaan_id = pa and sumber = 'mata_agen') = 2);
  perform pg_temp.cek('terakhir dipakai tercatat', (select terakhir_at is not null from public.agen_mata where id = aid));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'agen_mata: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
