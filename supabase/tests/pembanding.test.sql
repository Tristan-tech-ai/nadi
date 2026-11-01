-- Tes F6-02: kelompok < 10 usaha sejenis = tanpa angka kelompok (hanya n); kelompok >= 10 = kuartil; industri lain tidak ikut;
-- staf dan anon ditolak. Kelompok uji memakai industri unik ('ujik') supaya data usaha lain tidak memengaruhi.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  u uuid; p uuid; p0 uuid; ka text; r jsonb; i int; ids uuid[] := '{}';
begin
  begin
    -- 9 usaha 'ujik' dengan 1..9 orang aktif; usaha 'lainik' dengan 50 orang (tidak boleh ikut).
    for i in 1..10 loop
      u := gen_random_uuid();
      insert into auth.users (id, email) values (u, 'banding' || i || '@uji.local');
      execute 'set local role authenticated';
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      p := public.buat_perusahaan('Banding ' || i, case when i = 10 then 'lainik' else 'ujik' end);
      execute 'reset role';
      insert into public.orang (perusahaan_id, nama) select p, 'Orang ' || g from generate_series(1, case when i = 10 then 50 else i end) g;
      ids := ids || p;
      if i = 1 then p0 := p; ka := json_build_object('sub', u, 'role', 'authenticated', 'app_metadata', json_build_object('pid', p, 'prn', 'pemilik'))::text; end if;
    end loop;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.pembanding_usaha();
    perform pg_temp.cek('9 usaha sejenis: tanpa angka kelompok, hanya n', (r -> 'ukuran' -> 'orang_aktif' ->> 'n')::int = 9
      and not (r -> 'ukuran' -> 'orang_aktif' ->> 'cukup')::boolean and not (r -> 'ukuran' -> 'orang_aktif' ? 'median')
      and not (r -> 'ukuran' -> 'orang_aktif' ? 'q1') and (r -> 'ukuran' -> 'orang_aktif' ->> 'sendiri')::numeric = 1, r::text);
    perform pg_temp.cek('ukuran tanpa data (invoice) juga tanpa angka kelompok', not (r -> 'ukuran' -> 'hari_lunas' ? 'median'), r::text);

    -- Usaha ke-10 sejenis: sekarang cukup.
    execute 'reset role';
    u := gen_random_uuid();
    insert into auth.users (id, email) values (u, 'banding11@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    p := public.buat_perusahaan('Banding 11', 'ujik');
    execute 'reset role';
    insert into public.orang (perusahaan_id, nama) select p, 'Orang ' || g from generate_series(1, 10) g;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.pembanding_usaha();
    perform pg_temp.cek('10 usaha sejenis: kuartil muncul, industri lain (50 orang) tidak ikut', (r -> 'ukuran' -> 'orang_aktif' ->> 'n')::int = 10
      and (r -> 'ukuran' -> 'orang_aktif' ->> 'cukup')::boolean and (r -> 'ukuran' -> 'orang_aktif' ->> 'median')::numeric = 5.5
      and (r -> 'ukuran' -> 'orang_aktif' ->> 'q3')::numeric < 50, r::text);

    -- Staf sungguhan (peran dibaca dari keanggotaan, bukan klaim JWT).
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (p0, 'Staf Banding') returning id into p;
    perform public.buat_akun_staf(p, '123456');
    execute 'reset role';
    select user_id into u from public.orang where id = p;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'app_metadata', json_build_object('pid', p0, 'prn', 'staf'))::text, true);
    begin perform public.pembanding_usaha(); perform pg_temp.cek('peran staf ditolak', false);
    exception when others then perform pg_temp.cek('peran staf ditolak', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform public.pembanding_usaha(); perform pg_temp.cek('anon ditolak', false);
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
