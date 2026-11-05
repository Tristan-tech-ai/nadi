-- Tes W-02 Mata v2: jenis zona baru; rekap kunjungan per jam hanya setelah papan informasi dinyatakan terpasang (UU 27/2022
-- Pasal 17 ayat (1) huruf b); kunci kiriman idempoten; batas wajar angka, jam, zona, jalur; peta panas menjumlah per zona dan
-- menyembunyikan jalur < 3 kunjungan; tabel rekap tanpa kolom per orang; isolasi usaha; staf dan anon ditolak.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; o_s uuid; u_s uuid;
  r jsonb; zp uuid; zk uuid; za uuid; zw uuid; zb uuid; hari date; jam timestamptz := date_trunc('hour', now()) - interval '1 hour';
  kotak jsonb := '[[0.1,0.5],[0.4,0.5],[0.4,0.9],[0.1,0.9]]';
  rekap jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'mata2-a@uji.local'), (ub, 'mata2-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Toko Uji Mata Dua', 'toko');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Mata Dua B', 'toko');
    execute 'reset role';
    hari := app.hari_ini(pa);
    execute 'set local role authenticated';
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

    -- Jenis zona baru lewat nama baru dan pembungkus lama.
    perform set_config('request.jwt.claims', ka, true);
    r := public.save_vision_zones(jsonb_build_array(
      jsonb_build_object('nama', 'Pintu', 'jenis', 'pintu', 'poligon', kotak),
      jsonb_build_object('nama', 'Kasir', 'jenis', 'kasir', 'poligon', kotak),
      jsonb_build_object('nama', 'Antrean', 'jenis', 'antrean', 'poligon', kotak),
      jsonb_build_object('nama', 'Balik meja', 'jenis', 'kerja', 'poligon', kotak)));
    perform pg_temp.cek('zona pintu, kasir, antrean, kerja tersimpan', jsonb_array_length(r) = 4, r::text);
    zp := (r -> 0 ->> 'id')::uuid; zk := (r -> 1 ->> 'id')::uuid; za := (r -> 2 ->> 'id')::uuid; zw := (r -> 3 ->> 'id')::uuid;
    r := public.simpan_zona_mata(jsonb_build_array(
      jsonb_build_object('id', zp, 'nama', 'Pintu', 'jenis', 'pintu', 'poligon', kotak),
      jsonb_build_object('id', zk, 'nama', 'Kasir', 'jenis', 'kasir', 'poligon', kotak),
      jsonb_build_object('id', za, 'nama', 'Antrean', 'jenis', 'antrean', 'poligon', kotak),
      jsonb_build_object('id', zw, 'nama', 'Balik meja', 'jenis', 'kerja', 'poligon', kotak),
      jsonb_build_object('nama', 'Lorong 1', 'jenis', 'lorong', 'poligon', kotak)));
    perform pg_temp.cek('pembungkus lama menerima lorong', jsonb_array_length(r) = 5 and r -> 4 ->> 'jenis' = 'lorong', r::text);
    begin perform public.save_vision_zones(jsonb_build_array(jsonb_build_object('nama', 'Parkir', 'jenis', 'parkir', 'poligon', kotak)));
      perform pg_temp.cek('jenis tak dikenal tetap ditolak', false);
    exception when others then perform pg_temp.cek('jenis tak dikenal tetap ditolak', sqlstate = '22023', sqlerrm); end;

    rekap := jsonb_build_array(jsonb_build_object('jam', jam, 'kunjungan', 4, 'lamaDetik', 1200, 'tungguN', 2, 'tungguDetik', 180,
      'layanN', 3, 'layanDetik', 90, 'zona', jsonb_build_object(zk, jsonb_build_object('lintas', 3, 'detik', 90), za, jsonb_build_object('lintas', 2, 'detik', 180)),
      'jalur', jsonb_build_object('Pintu > Kasir > Pintu', 3, 'Pintu > Lorong 1', 1)));

    -- Papan informasi wajib dulu.
    begin perform public.record_vision_visits(rekap, 'kiriman-uji-0001');
      perform pg_temp.cek('tanpa papan informasi ditolak', false);
    exception when others then perform pg_temp.cek('tanpa papan informasi ditolak', sqlstate = '55000' and sqlerrm like '%Pasal 17%', sqlerrm); end;
    r := public.set_vision_notice(true);
    perform pg_temp.cek('papan dicatat dengan waktu dan pengguna', r ->> 'by' = ua::text and r ? 'at', r::text);

    r := public.record_vision_visits(rekap, 'kiriman-uji-0001');
    perform pg_temp.cek('rekap 1 jam tercatat', r = '{"sudah": false, "jam": 1}'::jsonb, r::text);
    r := public.record_vision_visits(rekap, 'kiriman-uji-0001');
    perform pg_temp.cek('kunci sama tidak dijumlah dua kali', r ->> 'sudah' = 'true' and (select visits from public.vision_hourly where hour = jam) = 4, r::text);
    r := public.record_vision_visits(rekap, 'kiriman-uji-0002');
    perform pg_temp.cek('kiriman baru dijumlahkan ke jam yang sama', (select visits = 8 and dwell_seconds = 2400 and waited = 4 and served = 6 from public.vision_hourly where hour = jam)
      and (select seconds from public.vision_hourly_zone where zone_id = za) = 360, r::text);

    -- Batas wajar.
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('jam', jam + interval '7 minutes')), 'kiriman-uji-0003');
      perform pg_temp.cek('jam bukan awal jam ditolak', false);
    exception when others then perform pg_temp.cek('jam bukan awal jam ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('jam', jam + interval '3 hours')), 'kiriman-uji-0004');
      perform pg_temp.cek('jam masa depan ditolak', false);
    exception when others then perform pg_temp.cek('jam masa depan ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('jam', jam - interval '8 days')), 'kiriman-uji-0005');
      perform pg_temp.cek('jam lebih dari 7 hari lalu ditolak', false);
    exception when others then perform pg_temp.cek('jam lebih dari 7 hari lalu ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('tungguN', 9)), 'kiriman-uji-0006');
      perform pg_temp.cek('menunggu lebih banyak dari kunjungan ditolak', false);
    exception when others then perform pg_temp.cek('menunggu lebih banyak dari kunjungan ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('zona', jsonb_build_object(zk, jsonb_build_object('lintas', 9, 'detik', 10)))), 'kiriman-uji-0007');
      perform pg_temp.cek('lintas zona lebih dari kunjungan ditolak', false);
    exception when others then perform pg_temp.cek('lintas zona lebih dari kunjungan ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('zona', jsonb_build_object('bukan-uuid', jsonb_build_object('lintas', 1, 'detik', 10)))), 'kiriman-uji-0008');
      perform pg_temp.cek('kunci zona rusak ditolak', false);
    exception when others then perform pg_temp.cek('kunci zona rusak ditolak', sqlstate = 'P0002', sqlerrm); end;
    begin perform public.record_vision_visits(jsonb_build_array(rekap -> 0 || jsonb_build_object('jalur', jsonb_build_object('Pintu', 'banyak'))), 'kiriman-uji-0009');
      perform pg_temp.cek('jumlah jalur bukan angka ditolak', false);
    exception when others then perform pg_temp.cek('jumlah jalur bukan angka ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.record_vision_visits(rekap, 'pendek');
      perform pg_temp.cek('kunci kiriman pendek ditolak', false);
    exception when others then perform pg_temp.cek('kunci kiriman pendek ditolak', sqlstate = '22023', sqlerrm); end;
    perform pg_temp.cek('kiriman yang ditolak tidak mengubah angka', (select visits from public.vision_hourly where hour = jam) = 8);

    -- Peta panas.
    r := public.vision_heatmap(hari - 1, hari);
    perform pg_temp.cek('ringkasan peta panas', (r ->> 'kunjungan')::int = 8 and (r ->> 'lamaDetik')::int = 2400 and (r ->> 'tungguN')::int = 4 and (r ->> 'layanDetik')::int = 180, r::text);
    perform pg_temp.cek('detik per zona, zona tanpa data bernilai 0', (select bool_and(case z ->> 'nama' when 'Antrean' then (z ->> 'detik')::int = 360 when 'Kasir' then (z ->> 'detik')::int = 180 and (z ->> 'lintas')::int = 6 else (z ->> 'detik')::int = 0 end)
      from jsonb_array_elements(r -> 'zona') z) and jsonb_array_length(r -> 'zona') = 5, (r -> 'zona')::text);
    perform pg_temp.cek('jalur >= 3 tampil, jalur < 3 disembunyikan', r -> 'jalur' = '[{"jalur": "Pintu > Kasir > Pintu", "kunjungan": 6}]'::jsonb, (r -> 'jalur')::text);
    perform pg_temp.cek('kunjungan per jam zona usaha', (r -> 'jam' -> 0 ->> 'kunjungan')::int = 8 and (r -> 'jam' -> 0 ->> 'jam')::int = extract(hour from jam at time zone 'Asia/Jakarta')::int
      or (select zona_waktu from public.perusahaan where id = pa) <> 'Asia/Jakarta', (r -> 'jam')::text);
    perform pg_temp.cek('status papan ikut peta panas', r -> 'papan' ->> 'by' = ua::text);
    begin perform public.vision_heatmap(hari - 40, hari);
      perform pg_temp.cek('rentang lebih dari 31 hari ditolak', false);
    exception when others then perform pg_temp.cek('rentang lebih dari 31 hari ditolak', sqlstate = '22023', sqlerrm); end;
    begin insert into public.vision_hourly (perusahaan_id, hour, visits) values (pa, jam - interval '1 hour', 99);
      perform pg_temp.cek('tulis langsung ke vision_hourly ditolak', false);
    exception when others then perform pg_temp.cek('tulis langsung ke vision_hourly ditolak', sqlstate = '42501', sqlerrm); end;
    r := public.set_vision_notice(false);
    begin perform public.record_vision_visits(rekap, 'kiriman-uji-0010');
      perform pg_temp.cek('papan dicabut: pencatatan berhenti', false);
    exception when others then perform pg_temp.cek('papan dicabut: pencatatan berhenti', sqlstate = '55000', sqlerrm); end;

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform public.set_vision_notice(true);
    r := public.vision_heatmap(hari - 1, hari);
    perform pg_temp.cek('usaha B tidak melihat rekap A', (select count(*) from public.vision_hourly) = 0 and (select count(*) from public.vision_hourly_zone) = 0
      and (select count(*) from public.vision_hourly_path) = 0 and (r ->> 'kunjungan')::int = 0 and r -> 'zona' = '[]'::jsonb, r::text);
    begin perform public.record_vision_visits(rekap, 'kiriman-uji-b001');
      perform pg_temp.cek('usaha B tidak bisa menulis ke zona A', false);
    exception when others then perform pg_temp.cek('usaha B tidak bisa menulis ke zona A', sqlstate = 'P0002', sqlerrm); end;

    -- Staf dan anon.
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Mata Dua') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
    begin perform public.vision_heatmap(hari, hari); perform pg_temp.cek('staf tidak membuka peta panas', false);
    exception when others then perform pg_temp.cek('staf tidak membuka peta panas', sqlstate = '42501', sqlerrm); end;
    perform pg_temp.cek('staf tidak membaca rekap', (select count(*) from public.vision_hourly) = 0);
    begin perform public.set_vision_notice(true); perform pg_temp.cek('staf tidak mengubah papan', false);
    exception when others then perform pg_temp.cek('staf tidak mengubah papan', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.record_vision_visits(rekap, 'kiriman-uji-anon'); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
    execute 'reset role';

    -- Tidak ada kolom per orang di tabel rekap.
    perform pg_temp.cek('tabel rekap hanya berisi jumlah dan detik', (select array_agg(column_name::text order by column_name) from information_schema.columns
      where table_schema = 'public' and table_name = 'vision_hourly') = array['dwell_seconds', 'hour', 'perusahaan_id', 'served', 'service_seconds', 'updated_at', 'visits', 'wait_seconds', 'waited']);
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
