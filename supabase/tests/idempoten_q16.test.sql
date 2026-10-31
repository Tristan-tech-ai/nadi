-- Tes Q-16: kunci idempoten dari browser untuk lowongan dan rencana magang. Kiriman ulang berkunci sama (experimental.useOffline
-- mengulang Server Action yang jawabannya hilang) menghasilkan satu baris dan id sama; kunci berbeda membuat baris baru; kunci
-- sama di usaha lain tidak bentrok. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  o_m uuid; o_p uuid; o_mb uuid; o_pb uuid; k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
  r1 jsonb; r2 jsonb; r3 jsonb; rb jsonb; l1 uuid; n int;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Mentor B') returning id into o_mb;
    insert into public.orang (perusahaan_id, nama) values (pb, 'Peserta B') returning id into o_pb;

    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Mentor') returning id into o_m;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Magang') returning id into o_p;

    -- Rencana magang: kunci sama dua kali = satu rencana, id sama, ditandai sudah.
    r1 := public.simpan_rencana_magang(null, o_p, o_m, null, date '2026-11-01', date '2026-12-31', '{}'::jsonb, 'Bisa kasir sendiri',
      '[]'::jsonb, null, 'rencana', null, k1);
    r2 := public.simpan_rencana_magang(null, o_p, o_m, null, date '2026-11-01', date '2026-12-31', '{}'::jsonb, 'Bisa kasir sendiri',
      '[]'::jsonb, null, 'rencana', null, k1);
    perform pg_temp.cek('rencana: kunci sama mengembalikan id sama', r1 ->> 'id' = r2 ->> 'id', r1::text || ' ' || r2::text);
    perform pg_temp.cek('rencana: ulangan ditandai sudah', (r2 ->> 'sudah')::boolean, r2::text);
    select count(*) into n from public.rencana_magang where perusahaan_id = pa;
    perform pg_temp.cek('rencana: hanya satu baris', n = 1, n::text);
    r3 := public.simpan_rencana_magang(null, o_p, o_m, null, date '2026-11-01', date '2026-12-31', '{}'::jsonb, 'Bisa kasir sendiri',
      '[]'::jsonb, null, 'rencana', null, k2);
    perform pg_temp.cek('rencana: kunci berbeda membuat rencana baru', r3 ->> 'id' <> r1 ->> 'id', r3::text);
    r3 := public.simpan_rencana_magang(null, o_p, o_m, null, date '2026-11-01', date '2026-12-31', '{}'::jsonb, 'Tanpa kunci',
      '[]'::jsonb, null, 'rencana', null);
    perform pg_temp.cek('rencana: tanpa kunci tetap jalan (pemanggil lama)', r3 ->> 'id' is not null, r3::text);

    -- Lowongan lewat insert biasa (RLS): kunci sama kedua kalinya ditolak unik (23505), baris tetap satu.
    insert into public.lowongan (perusahaan_id, judul, kunci_klien) values (pa, 'Pelayan pagi', k1) returning id into l1;
    begin
      insert into public.lowongan (perusahaan_id, judul, kunci_klien) values (pa, 'Pelayan pagi', k1);
      perform pg_temp.cek('lowongan: kunci sama ditolak unik', false);
    exception when unique_violation then perform pg_temp.cek('lowongan: kunci sama ditolak unik', true);
    end;
    select count(*) into n from public.lowongan where perusahaan_id = pa and kunci_klien = k1;
    perform pg_temp.cek('lowongan: hanya satu baris berkunci itu', n = 1, n::text);
    insert into public.lowongan (perusahaan_id, judul) values (pa, 'Tanpa kunci 1'), (pa, 'Tanpa kunci 2');
    perform pg_temp.cek('lowongan: banyak baris tanpa kunci tetap boleh',
      (select count(*) from public.lowongan where perusahaan_id = pa and kunci_klien is null) = 2);

    -- Usaha lain memakai kunci yang sama: tidak bentrok, dan tidak menerima baris usaha A.
    perform set_config('request.jwt.claims', kb, true);
    rb := public.simpan_rencana_magang(null, o_pb, o_mb, null, date '2026-11-01', date '2026-12-31', '{}'::jsonb, 'Bisa gudang',
      '[]'::jsonb, null, 'rencana', null, k1);
    perform pg_temp.cek('rencana: kunci sama di usaha lain membuat rencana miliknya', rb ->> 'id' <> r1 ->> 'id'
      and (select perusahaan_id from public.rencana_magang where id = (rb ->> 'id')::uuid) = pb, rb::text);
    begin
      insert into public.lowongan (perusahaan_id, judul, kunci_klien) values (pb, 'Gudang', k1);
      perform pg_temp.cek('lowongan: kunci sama di usaha lain boleh', true);
    exception when others then perform pg_temp.cek('lowongan: kunci sama di usaha lain boleh', false, sqlstate || ' ' || sqlerrm);
    end;
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
