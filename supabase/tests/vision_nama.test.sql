-- Tes I-04: nama Inggris modul Mata (vision) adalah implementasi, nama lama pembungkus tipis yang memberi hasil sama.
-- Hak: vision_agent_* untuk anon, lainnya hanya authenticated; nama lama tetap dengan hak lamanya. Regresi perilaku tetap
-- dijalankan lewat mata.test.sql dan agen_mata.test.sql (memanggil nama lama).
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; r jsonb; r2 jsonb; z1 uuid; n int; tok text; aid uuid;
  baru text[] := array['save_vision_zones(jsonb)', 'record_vision_state(jsonb)', 'vision_state()', 'create_vision_agent_token(text)',
                       'revoke_vision_agent_token(uuid)', 'vision_agent_zones(text)', 'vision_agent_record(text,jsonb)'];
  lama text[] := array['simpan_zona_mata(jsonb)', 'catat_mata(jsonb)', 'mata_keadaan()', 'buat_token_agen_mata(text)',
                       'cabut_token_agen_mata(uuid)', 'agen_mata_zona(text)', 'agen_mata_catat(text,jsonb)'];
  f text;
begin
  begin
    perform pg_temp.cek('7 fungsi nama Inggris ada dan security definer',
      (select count(*) from unnest(baru) b where (select prosecdef from pg_proc where oid = to_regprocedure('public.' || b))) = 7);
    perform pg_temp.cek('7 nama lama tetap ada sebagai pembungkus sql security invoker',
      (select count(*) from unnest(lama) l join pg_proc p on p.oid = to_regprocedure('public.' || l)
        join pg_language g on g.oid = p.prolang where g.lanname = 'sql' and not p.prosecdef) = 7);
    perform pg_temp.cek('anon hanya boleh vision_agent_*',
      has_function_privilege('anon', 'public.vision_agent_zones(text)', 'execute')
      and has_function_privilege('anon', 'public.vision_agent_record(text,jsonb)', 'execute')
      and not has_function_privilege('anon', 'public.save_vision_zones(jsonb)', 'execute')
      and not has_function_privilege('anon', 'public.create_vision_agent_token(text)', 'execute')
      and not has_function_privilege('anon', 'public.vision_state()', 'execute'));
    perform pg_temp.cek('hak nama lama tidak berubah',
      has_function_privilege('anon', 'public.agen_mata_catat(text,jsonb)', 'execute')
      and not has_function_privilege('anon', 'public.simpan_zona_mata(jsonb)', 'execute')
      and has_function_privilege('authenticated', 'public.simpan_zona_mata(jsonb)', 'execute'));

    insert into auth.users (id, email) values (ua, 'vision-a@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Vision', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    r := public.save_vision_zones('[{"nama": "Meja 1", "jenis": "meja", "poligon": [[0,0],[0.5,0],[0.5,0.5],[0,0.5]]}]'::jsonb);
    z1 := (r -> 0 ->> 'id')::uuid;
    perform pg_temp.cek('save_vision_zones menyimpan', jsonb_array_length(r) = 1, r::text);
    n := public.record_vision_state(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi')));
    perform pg_temp.cek('record_vision_state mencatat', n = 1, n::text);
    n := public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi')));
    perform pg_temp.cek('nama lama melihat keadaan yang sama (tidak dicatat ulang)', n = 0, n::text);
    r := public.vision_state(); r2 := public.mata_keadaan();
    perform pg_temp.cek('vision_state = mata_keadaan', r = r2 and r -> 0 ->> 'status' = 'terisi', r::text);
    tok := public.create_vision_agent_token('Kotak vision');
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform pg_temp.cek('vision_agent_zones = agen_mata_zona', public.vision_agent_zones(tok) = public.agen_mata_zona(tok));
    n := public.vision_agent_record(tok, jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'kosong')));
    perform pg_temp.cek('vision_agent_record mencatat', n = 1, n::text);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    select id into aid from public.agen_mata where nama = 'Kotak vision';
    perform public.revoke_vision_agent_token(aid);
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    begin perform public.agen_mata_catat(tok, '[]'::jsonb); perform pg_temp.cek('token dicabut lewat nama baru ditolak di nama lama', false);
    exception when sqlstate '28000' then perform pg_temp.cek('token dicabut lewat nama baru ditolak di nama lama', true); end;
    execute 'reset role';
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'vision_nama: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
