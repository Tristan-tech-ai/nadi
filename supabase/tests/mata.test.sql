-- Tes F5-01 Mata: zona disimpan lewat RPC (validasi poligon 0..1, 3..20 titik, jenis dikenal, nama), zona yang dihapus dari
-- daftar menjadi nonaktif (tidak dihapus); catat_mata hanya mencatat kejadian saat status/jumlah berubah, menolak zona usaha
-- lain atau nonaktif, menjepit waktu ke 10 menit terakhir; mata_keadaan memberi status terakhir per zona aktif; hanya
-- pemilik/admin (staf dan anon ditolak); usaha lain tidak melihat zona maupun kejadian.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; o_s uuid; u_s uuid;
  r jsonb; z1 uuid; z2 uuid; zb uuid; n int;
  kotak jsonb := '[[0.1,0.5],[0.4,0.5],[0.4,0.9],[0.1,0.9]]';
begin
  begin
    insert into auth.users (id, email) values (ua, 'mata-a@uji.local'), (ub, 'mata-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Mata', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Mata B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

    perform set_config('request.jwt.claims', ka, true);
    r := public.simpan_zona_mata(jsonb_build_array(
      jsonb_build_object('nama', 'Meja 1', 'jenis', 'meja', 'poligon', kotak),
      jsonb_build_object('nama', 'Kasir', 'jenis', 'antrean', 'poligon', '[[0.5,0.1],[0.9,0.1],[0.9,0.4]]'::jsonb)));
    perform pg_temp.cek('simpan 2 zona', jsonb_array_length(r) = 2, r::text);
    z1 := (r -> 0 ->> 'id')::uuid; z2 := (r -> 1 ->> 'id')::uuid;
    begin perform public.simpan_zona_mata(jsonb_build_array(jsonb_build_object('nama', 'Rusak', 'jenis', 'meja', 'poligon', '[[0.1,0.1],[1.5,0.1],[0.5,0.5]]'::jsonb)));
      perform pg_temp.cek('poligon di luar 0..1 ditolak', false);
    exception when others then perform pg_temp.cek('poligon di luar 0..1 ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.simpan_zona_mata(jsonb_build_array(jsonb_build_object('nama', 'Dua titik', 'jenis', 'meja', 'poligon', '[[0.1,0.1],[0.5,0.5]]'::jsonb)));
      perform pg_temp.cek('poligon < 3 titik ditolak', false);
    exception when others then perform pg_temp.cek('poligon < 3 titik ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.simpan_zona_mata(jsonb_build_array(jsonb_build_object('nama', 'Aneh', 'jenis', 'parkir', 'poligon', kotak)));
      perform pg_temp.cek('jenis tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('jenis tak dikenal ditolak', sqlstate = '22023', sqlerrm); end;

    -- Kejadian: hanya saat berubah.
    n := public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi'), jsonb_build_object('zona', z2, 'jumlah', 3)));
    perform pg_temp.cek('catat 2 kejadian pertama', n = 2, n::text);
    n := public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi'), jsonb_build_object('zona', z2, 'jumlah', 3)));
    perform pg_temp.cek('status sama tidak dicatat ulang', n = 0, n::text);
    n := public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'kosong'), jsonb_build_object('zona', z2, 'jumlah', 1)));
    perform pg_temp.cek('perubahan dicatat', n = 2, n::text);
    r := public.mata_keadaan();
    perform pg_temp.cek('keadaan terakhir per zona', (select bool_and(case z ->> 'nama' when 'Meja 1' then z ->> 'status' = 'kosong' when 'Kasir' then (z ->> 'jumlah')::int = 1 end)
      from jsonb_array_elements(r) z) and jsonb_array_length(r) = 2, r::text);
    begin perform public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'penuh')));
      perform pg_temp.cek('status meja tak dikenal ditolak', false);
    exception when others then perform pg_temp.cek('status meja tak dikenal ditolak', sqlstate = '22023', sqlerrm); end;
    n := public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi', 'terjadi_at', now() - interval '3 hours')));
    execute 'reset role';
    perform pg_temp.cek('waktu dijepit ke 10 menit terakhir', (select min(terjadi_at) from public.kejadian where perusahaan_id = pa and jenis = 'mata.meja')
      >= now() - interval '10 minutes');
    perform pg_temp.cek('kejadian tanpa gambar: hanya zona dan status/jumlah', not exists (select 1 from public.kejadian where perusahaan_id = pa
      and jenis like 'mata.%' and exists (select 1 from jsonb_object_keys(data) k where k not in ('zona', 'nama', 'status', 'jumlah'))));

    -- Zona yang hilang dari daftar menjadi nonaktif.
    execute 'set local role authenticated';
    r := public.simpan_zona_mata(jsonb_build_array(jsonb_build_object('id', z1, 'nama', 'Meja 1 dekat jendela', 'jenis', 'meja', 'poligon', kotak)));
    execute 'reset role';
    perform pg_temp.cek('zona Kasir nonaktif, tidak dihapus; Meja 1 berganti nama', (select not aktif from public.zona_mata where id = z2)
      and (select nama from public.zona_mata where id = z1) = 'Meja 1 dekat jendela');
    execute 'set local role authenticated';
    begin perform public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z2, 'jumlah', 5)));
      perform pg_temp.cek('zona nonaktif ditolak', false);
    exception when others then perform pg_temp.cek('zona nonaktif ditolak', sqlstate = 'P0002', sqlerrm); end;

    -- Isolasi.
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha B tidak melihat zona A', (select count(*) from public.zona_mata) = 0 and jsonb_array_length(public.mata_keadaan()) = 0);
    begin perform public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'terisi')));
      perform pg_temp.cek('usaha B tidak bisa mencatat ke zona A', false);
    exception when others then perform pg_temp.cek('usaha B tidak bisa mencatat ke zona A', sqlstate = 'P0002', sqlerrm); end;
    begin insert into public.zona_mata (perusahaan_id, nama, jenis, poligon) values (pb, 'X', 'meja', kotak);
      perform pg_temp.cek('tulis langsung ke zona_mata ditolak', false);
    exception when others then perform pg_temp.cek('tulis langsung ke zona_mata ditolak', sqlstate = '42501', sqlerrm); end;

    -- Staf dan anon.
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Mata') returning id into o_s;
    perform public.buat_akun_staf(o_s, '123456');
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
    begin perform public.catat_mata(jsonb_build_array(jsonb_build_object('zona', z1, 'status', 'kosong')));
      perform pg_temp.cek('staf ditolak', false);
    exception when others then perform pg_temp.cek('staf ditolak', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.mata_keadaan(); perform pg_temp.cek('anon ditolak', false);
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
