-- Tes F5-02 Peta Usaha langsung: kejadian Mata disiarkan (realtime.send) ke topik privat peta:<usaha>; kebijakan realtime.messages
-- hanya mengizinkan pemilik/admin usaha itu membaca topiknya sendiri; denah demo (6 meja + antrean warung, 4 rak + antrean toko)
-- terbaca anon lewat peta_demo; simulasi mengubah status demo, menyiarkan ke topik publik peta-demo:<kunci>, dan tidak menulis
-- kejadian (tabel tidak tumbuh).
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- realtime.messages dipartisi harian oleh layanan Realtime saat dipakai; bila partisi hari ini belum ada, realtime.send hanya
-- memberi WARNING. Tes membuat partisi sementara di dalam transaksinya sendiri (dibatalkan di akhir).
do $$
begin
  if not exists (select 1 from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'realtime.messages'::regclass
                  and pg_get_expr(c.relpartbound, c.oid) like '%' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD') || '%') then
    execute format('create table realtime.messages_uji_peta partition of realtime.messages for values from (%L) to (%L)',
                   (now() at time zone 'UTC') - interval '1 day', (now() at time zone 'UTC') + interval '1 day');
  end if;
end $$;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; r jsonb; z1 uuid; n int; sebelum jsonb; kej bigint;
begin
  begin
    insert into auth.users (id, email) values (ua, 'peta-a@uji.local'), (ub, 'peta-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Peta', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Peta B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    r := public.simpan_zona_mata('[{"nama": "Meja 1", "jenis": "meja", "poligon": [[0.1,0.1],[0.3,0.1],[0.3,0.3]]}]'::jsonb);
    z1 := (r -> 0 ->> 'id')::uuid;
    perform public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi')));
    execute 'reset role';
    perform pg_temp.cek('kejadian Mata disiarkan ke topik privat peta:<usaha>', exists (select 1 from realtime.messages m
      where m.topic = 'peta:' || pa and m.private and m.event = 'zona' and m.payload ->> 'zona' = z1::text and m.payload ->> 'status' = 'terisi'));

    -- Kebijakan: pemilik A membaca topiknya; B tidak membaca topik A.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform set_config('realtime.topic', 'peta:' || pa, true);
    perform pg_temp.cek('pemilik A boleh menerima topik usahanya', (select count(*) from realtime.messages where topic = 'peta:' || pa and extension = 'broadcast') >= 1);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('pemilik B tidak menerima topik usaha A', (select count(*) from realtime.messages where topic = 'peta:' || pa) = 0);
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
    perform pg_temp.cek('klaim pid palsu tidak membuka topik usaha lain', (select count(*) from realtime.messages where topic = 'peta:' || pa) = 0);
    execute 'reset role';

    -- Demo publik.
    execute 'set local role anon';
    r := public.peta_demo('fnb');
    perform pg_temp.cek('denah demo warung: 6 meja + 1 antrean', (select count(*) filter (where z ->> 'jenis' = 'meja') = 6 and count(*) filter (where z ->> 'jenis' = 'antrean') = 1
      from jsonb_array_elements(r -> 'zona') z) and r ->> 'topik' = 'peta-demo:fnb', r::text);
    perform pg_temp.cek('denah demo toko: 4 rak + 1 antrean', (select count(*) filter (where z ->> 'jenis' = 'rak') = 4 and count(*) filter (where z ->> 'jenis' = 'antrean') = 1
      from jsonb_array_elements(public.peta_demo('toko') -> 'zona') z));
    perform pg_temp.cek('kunci demo tak dikenal = null', public.peta_demo('gudang') is null);
    begin perform app.simulasi_peta_demo(); perform pg_temp.cek('anon tidak bisa menjalankan simulasi', false);
    exception when others then perform pg_temp.cek('anon tidak bisa menjalankan simulasi', sqlstate = '42501', sqlerrm); end;
    execute 'reset role';
    sebelum := public.peta_demo('fnb') -> 'zona';
    select count(*) into kej from public.kejadian k join public.perusahaan p on p.id = k.perusahaan_id where p.pengaturan ? 'demo';
    n := app.simulasi_peta_demo();
    perform pg_temp.cek('simulasi mengubah 2 zona per usaha demo', n = 4, n::text);
    perform pg_temp.cek('status demo berubah', (public.peta_demo('fnb') -> 'zona') <> sebelum);
    perform pg_temp.cek('simulasi disiarkan ke topik publik', (select count(*) from realtime.messages where topic in ('peta-demo:fnb', 'peta-demo:toko') and not private) >= 4);
    perform pg_temp.cek('simulasi tidak menulis kejadian', (select count(*) from public.kejadian k join public.perusahaan p on p.id = k.perusahaan_id where p.pengaturan ? 'demo') = kej);
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
