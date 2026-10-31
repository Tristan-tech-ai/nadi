-- Tes Q-27 (docs/design/rata-rata-beban.md, docs/quality/rencana-uji-q27.md): rata-rata beban tim di public.beban_saya dihitung
-- dari kelompok pembanding, yaitu orang yang memakai papan kerja minggu itu (poin, antre, atau selesai_n > 0). Rata-rata tampil
-- bila kelompok minimal 3 orang; di_atas butuh poin > 1,5 x rata-rata DAN selisih minimal 4 poin. Baris tabel contoh di rancangan
-- diuji persis. Tiga usaha sintetis: A (50 orang tanpa kerja + 2/4/6, lalu 2/4/12), B (1/1/3), C (10 tanpa kerja + 2 berpoin,
-- lalu satu orang yang hanya punya antre). Transaksi dibatalkan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Bagian 1: struktur. Tanda tangan, security definer, search_path kosong, dan hak execute sama seperti sebelum Q-27.
select pg_temp.cek('beban_saya: satu fungsi beban_saya(date) returns jsonb, plpgsql, stable, security definer, search_path kosong',
  count(*) = 1 and bool_and(p.oid = to_regprocedure('public.beban_saya(date)') and p.prorettype = 'jsonb'::regtype and l.lanname = 'plpgsql'
                            and p.provolatile = 's' and p.prosecdef and p.proconfig = array['search_path=""']),
  string_agg(p.oid::regprocedure::text || ' ' || p.provolatile::text || ' ' || p.prosecdef::text || ' ' || coalesce(p.proconfig::text, '-'), ', '))
  from pg_proc p join pg_language l on l.oid = p.prolang join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'beban_saya';

select pg_temp.cek('beban_saya: hak execute tetap (authenticated ya; anon dan public tidak)',
  has_function_privilege('authenticated', 'public.beban_saya(date)', 'execute')
  and not has_function_privilege('anon', 'public.beban_saya(date)', 'execute')
  and not has_function_privilege('public', 'public.beban_saya(date)', 'execute'),
  (select proacl::text from pg_proc where oid = to_regprocedure('public.beban_saya(date)')));

-- Bagian 2: tabel contoh.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; pc uuid;
  ka text; kb text; kc text; k_citra text; k_kosong text; k_fani text; k_hadi text; k_indra text;
  o_ani uuid; o_bayu uuid; o_citra uuid; o_kosong uuid; o_dodi uuid; o_eka uuid; o_fani uuid; o_gita uuid; o_hadi uuid; o_indra uuid;
  r jsonb;
begin
  begin
    insert into auth.users (id, email) values (ua, 'q27a@uji.local'), (ub, 'q27b@uji.local'), (uc, 'q27c@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Q27 A', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Warung Q27 B', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
    pc := public.buat_perusahaan('Toko Q27 C', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kc := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pc, 'prn', 'pemilik'))::text;

    -- Usaha A: 50 orang tanpa kerja, Ani 2, Bayu 4, Citra 6.
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) select pa, 'Kosong A ' || g from generate_series(1, 50) g;
    select id into o_kosong from public.orang where perusahaan_id = pa and nama = 'Kosong A 1';
    insert into public.orang (perusahaan_id, nama) values (pa, 'Ani Q27') returning id into o_ani;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Bayu Q27') returning id into o_bayu;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Citra Q27') returning id into o_citra;
    perform public.buat_akun_staf(o_citra, '123456');
    perform public.buat_akun_staf(o_kosong, '123456');
    k_citra := json_build_object('sub', (select user_id from public.orang where id = o_citra), 'role', 'authenticated',
                                 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    k_kosong := json_build_object('sub', (select user_id from public.orang where id = o_kosong), 'role', 'authenticated',
                                  'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Usaha B: Dodi 1, Eka 1, Fani 3.
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama) values (pb, 'Dodi Q27') returning id into o_dodi;
    insert into public.orang (perusahaan_id, nama) values (pb, 'Eka Q27') returning id into o_eka;
    insert into public.orang (perusahaan_id, nama) values (pb, 'Fani Q27') returning id into o_fani;
    perform public.buat_akun_staf(o_fani, '123456');
    k_fani := json_build_object('sub', (select user_id from public.orang where id = o_fani), 'role', 'authenticated',
                                'app_metadata', json_build_object('pid', pb, 'prn', 'staf'))::text;

    -- Usaha C: 10 orang tanpa kerja, Gita 2, Hadi 5; Indra nanti hanya punya antre.
    perform set_config('request.jwt.claims', kc, true);
    insert into public.orang (perusahaan_id, nama) select pc, 'Kosong C ' || g from generate_series(1, 10) g;
    insert into public.orang (perusahaan_id, nama) values (pc, 'Gita Q27') returning id into o_gita;
    insert into public.orang (perusahaan_id, nama) values (pc, 'Hadi Q27') returning id into o_hadi;
    insert into public.orang (perusahaan_id, nama) values (pc, 'Indra Q27') returning id into o_indra;
    perform public.buat_akun_staf(o_hadi, '123456');
    perform public.buat_akun_staf(o_indra, '123456');
    k_hadi := json_build_object('sub', (select user_id from public.orang where id = o_hadi), 'role', 'authenticated',
                                'app_metadata', json_build_object('pid', pc, 'prn', 'staf'))::text;
    k_indra := json_build_object('sub', (select user_id from public.orang where id = o_indra), 'role', 'authenticated',
                                 'app_metadata', json_build_object('pid', pc, 'prn', 'staf'))::text;

    -- Kerja selesai minggu ini (awal minggu zona tiap usaha + 1 jam).
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, mulai_at, selesai_at, dibuat_at)
    select x.pid, x.judul, x.orang, 'selesai', x.poin, w.mulai + interval '1 hour', w.mulai + interval '2 hours', w.mulai
      from (values (pa, 'Lap meja', o_ani, 2), (pa, 'Cuci piring', o_bayu, 4), (pa, 'Tutup kas', o_citra, 6),
                   (pb, 'Lap meja', o_dodi, 1), (pb, 'Sapu dapur', o_eka, 1), (pb, 'Rekap nota', o_fani, 3),
                   (pc, 'Tata rak', o_gita, 2), (pc, 'Stok opname', o_hadi, 5)) as x(pid, judul, orang, poin)
      cross join lateral (select (date_trunc('week', now() at time zone p.zona_waktu))::timestamp at time zone p.zona_waktu as mulai
                            from public.perusahaan p where p.id = x.pid) w;
    execute 'set local role authenticated';

    -- Baris 1: 50 orang tanpa kerja, 3 berpoin 2/4/6. Kelompok 3, rata 4, Citra 6 tidak di atas (6 > 6 salah).
    perform set_config('request.jwt.claims', k_citra, true);
    r := public.beban_saya();
    perform pg_temp.cek('2/4/6 (50 tanpa kerja tidak ikut): Citra 6, kelompok 3, rata 4', (r ->> 'poin')::numeric = 6
      and (r ->> 'n')::int = 3 and (r ->> 'n_kelompok')::int = 3 and (r ->> 'rata_rata')::numeric = 4, r::text);
    perform pg_temp.cek('2/4/6: Citra 6 tidak di atas rata-rata', r ->> 'di_atas' = 'false', r::text);

    -- Baris 5: saya tanpa kerja, tim 3 berpoin. Poin 0, rata tetap tampil, tidak di atas.
    perform set_config('request.jwt.claims', k_kosong, true);
    r := public.beban_saya();
    perform pg_temp.cek('saya tanpa kerja: poin 0, rata 4 dari kelompok 3, tidak di atas', (r ->> 'poin')::numeric = 0
      and (r ->> 'n_kelompok')::int = 3 and (r ->> 'rata_rata')::numeric = 4 and r ->> 'di_atas' = 'false', r::text);

    -- Baris 2: Citra 12 (2/4/12). Rata 6, 12 > 9 dan selisih 6 >= 4, di atas.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, mulai_at, selesai_at, dibuat_at)
    select pa, 'Setor bank', o_citra, 'selesai', 6, w.mulai + interval '1 hour', w.mulai + interval '3 hours', w.mulai
      from (select (date_trunc('week', now() at time zone p.zona_waktu))::timestamp at time zone p.zona_waktu as mulai
              from public.perusahaan p where p.id = pa) w;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', k_citra, true);
    r := public.beban_saya();
    perform pg_temp.cek('2/4/12: Citra 12, kelompok 3, rata 6, di atas', (r ->> 'poin')::numeric = 12 and (r ->> 'n_kelompok')::int = 3
      and (r ->> 'rata_rata')::numeric = 6 and r ->> 'di_atas' = 'true', r::text);
    perform set_config('request.jwt.claims', k_kosong, true);
    r := public.beban_saya();
    perform pg_temp.cek('2/4/12: orang tanpa kerja tetap tidak di atas', (r ->> 'poin')::numeric = 0 and (r ->> 'rata_rata')::numeric = 6
      and r ->> 'di_atas' = 'false', r::text);

    -- Baris 3: 1/1/3. Rata 1,7; 3 > 2,5 tetapi selisih 1,3 < 4, tidak di atas.
    perform set_config('request.jwt.claims', k_fani, true);
    r := public.beban_saya();
    perform pg_temp.cek('1/1/3: Fani 3, kelompok 3, rata 1,7', (r ->> 'poin')::numeric = 3 and (r ->> 'n_kelompok')::int = 3
      and (r ->> 'rata_rata')::numeric = 1.7, r::text);
    perform pg_temp.cek('1/1/3: Fani 3 tidak di atas karena selisih < 4', r ->> 'di_atas' = 'false', r::text);

    -- Baris 4: 2 orang berpoin (10 tanpa kerja). Kelompok 2, rata tidak tampil, tidak di atas.
    perform set_config('request.jwt.claims', k_hadi, true);
    r := public.beban_saya();
    perform pg_temp.cek('2 berpoin (10 tanpa kerja tidak ikut): kelompok 2, rata null, Hadi 5 tidak di atas', (r ->> 'poin')::numeric = 5
      and (r ->> 'n_kelompok')::int = 2 and (r ->> 'n')::int = 2 and r -> 'rata_rata' = 'null'::jsonb and r ->> 'di_atas' = 'false', r::text);

    -- Orang yang hanya punya antre (kerja ditugaskan, belum dimulai) ikut kelompok: 2/5/0 + 3 antre, rata (2 + 5 + 0) / 3 = 2,3.
    execute 'reset role';
    insert into public.kerja (perusahaan_id, judul, pelaksana_id, status, poin_beban, dibuat_at)
      values (pc, 'Hitung stok gudang', o_indra, 'baru', 3, now() - interval '1 minute');
    execute 'set local role authenticated';
    r := public.beban_saya();
    perform pg_temp.cek('antre ikut kelompok: kelompok 3, rata 2,3, Hadi 5 tidak di atas (selisih 2,7 < 4)',
      (r ->> 'n_kelompok')::int = 3 and (r ->> 'rata_rata')::numeric = 2.3 and r ->> 'di_atas' = 'false', r::text);
    perform set_config('request.jwt.claims', k_indra, true);
    r := public.beban_saya();
    perform pg_temp.cek('orang dengan antre saja: poin 0, rata 2,3, tidak di atas', (r ->> 'poin')::numeric = 0
      and (r ->> 'rata_rata')::numeric = 2.3 and r ->> 'di_atas' = 'false', r::text);
    perform pg_temp.cek('jawaban staf tanpa nama atau daftar orang', not (r ? 'orang') and r::text not like '%Q27%', r::text);

    -- Pemilik tanpa data orang: poin null, kelompok tetap dihitung.
    perform set_config('request.jwt.claims', ka, true);
    r := public.beban_saya();
    perform pg_temp.cek('pemilik tanpa data orang: poin null, kelompok 3, rata 6, tidak di atas', r -> 'poin' = 'null'::jsonb
      and (r ->> 'n_kelompok')::int = 3 and (r ->> 'rata_rata')::numeric = 6 and r ->> 'di_atas' = 'false', r::text);
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
