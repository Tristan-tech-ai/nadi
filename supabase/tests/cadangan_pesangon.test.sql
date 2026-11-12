-- Tes F4-09 cadangan pesangon (docs/research/pesangon-f4-09.md): aturan pesangon.pp35 (PHK sampai 27 Okt 2026) sama dengan tabel PP 35/2021
-- Pasal 40 ayat (2)-(3), RPC memakai pesangon.uu27 sejak 28 Okt 2026, di apps/web/src/lib/gaji/pesangon.test.ts; RPC cadangan_pesangon hanya untuk pemilik (lewat app.peran_aktif, bukan
-- klaim), memberi bahan hitung karyawan aktif saja (bukan magang, bukan nonaktif) dengan tanggal hari ini di zona usaha; saldo
-- cadangan hanya diatur pemilik; usaha lain terpisah. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uk uuid := gen_random_uuid();
  us uuid := gen_random_uuid();
  pa uuid; pb uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; ka text; kb text; kd text; kk text; ks text;
  r jsonb; a jsonb; n int; x text; v_hari date;
begin
  begin
    -- Struktur dan aturan.
    select nilai into a from public.aturan_bertanggal where kunci = 'pesangon.pp35' and terverifikasi;
    perform pg_temp.cek('aturan pesangon.pp35 terverifikasi = tabel Pasal 40 ayat (2) dan (3)',
      a -> 'pesangon' = '[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]]'::jsonb
      and a -> 'upmk' = '[[3,2],[6,3],[9,4],[12,5],[15,6],[18,7],[21,8],[24,10]]'::jsonb
      and a -> 'pengali' = '{"rugi":0.5,"pensiun":1.75}'::jsonb, coalesce(a::text, 'tidak ada'));
    perform pg_temp.cek('aturan menyebut sumber pasal', (select sumber ~ 'Pasal 40' and sumber ~ 'Pasal 157' from public.aturan_bertanggal where kunci = 'pesangon.pp35'));
    perform pg_temp.cek('RPC memeriksa peran lewat peran_aktif, bukan klaim',
      (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.cadangan_pesangon()'::regprocedure, 'public.atur_saldo_pesangon(bigint)'::regprocedure)));
    perform pg_temp.cek('anon tidak bisa memanggil RPC', not has_function_privilege('anon', 'public.cadangan_pesangon()', 'execute')
      and not has_function_privilege('anon', 'public.atur_saldo_pesangon(bigint)', 'execute'));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local'), (ud, 'd@uji.local'), (uk, 'k@uji.local'), (us, 's@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Pesangon', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Pesangon B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Sari', array['karyawan'], '{"mulai":"2022-09-01"}') returning id into o1;
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Budi', array['karyawan'], '{"mulai":"1 Sep 2022"}') returning id into o2;
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Dewi', array['karyawan'], '{"mulai":"2024-01-01","kontrak_selesai":"2027-06-30"}') returning id into o3;
    insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Magang', array['magang'], '{"mulai":"2026-01-01"}') returning id into o4;
    insert into public.orang (perusahaan_id, nama, jenis, status, data) values (pa, 'Lama', array['karyawan'], 'nonaktif', '{"mulai":"2010-01-01"}') returning id into o5;
    insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values
      (o1, pa, '{"pokok": 3500000, "tunjangan_tetap": 500000}'), (o4, pa, '{"pokok": 1000000}'), (o5, pa, '{"pokok": 9000000}');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pa;
    v_hari := app.hari_ini(pa);
    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, ud, 'admin', null), (pa, uk, 'akuntan', null), (pa, us, 'staf', o1);
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    kk := json_build_object('sub', uk, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'akuntan'))::text;
    ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Pemilik.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.cadangan_pesangon();
    perform pg_temp.cek('hari ini dari zona usaha (Asia/Jayapura)', (r ->> 'hari_ini')::date = v_hari, r ->> 'hari_ini');
    perform pg_temp.cek('aturan terbaru UU 27/2026 ikut dikirim dengan sumber', r -> 'aturan' ->> 'kunci' = 'pesangon.uu27'
      and r -> 'aturan' -> 'nilai' -> 'pesangon' = a -> 'pesangon' and r -> 'aturan' -> 'nilai' -> 'pengali' = '{"rugi":1,"pensiun":2}'::jsonb
      and r -> 'aturan' ->> 'sumber' ~ 'UU 27/2026 Pasal 231, 232', (r -> 'aturan')::text);
    select string_agg(e ->> 'nama', ',' order by e ->> 'nama') into x from jsonb_array_elements(r -> 'orang') e;
    perform pg_temp.cek('hanya karyawan aktif (tanpa magang dan nonaktif)', x = 'Budi,Dewi,Sari', x);
    select e into a from jsonb_array_elements(r -> 'orang') e where e ->> 'nama' = 'Sari';
    perform pg_temp.cek('Sari: mulai, pokok, tunjangan tetap', a ->> 'mulai' = '2022-09-01' and (a ->> 'pokok')::numeric = 3500000
      and (a ->> 'tunjangan_tetap')::numeric = 500000 and a ->> 'kontrak_selesai' is null, a::text);
    select e into a from jsonb_array_elements(r -> 'orang') e where e ->> 'nama' = 'Budi';
    perform pg_temp.cek('Budi: tanggal mulai tidak sah = null, tanpa gaji = null', a ->> 'mulai' is null and a ->> 'pokok' is null, a::text);
    select e into a from jsonb_array_elements(r -> 'orang') e where e ->> 'nama' = 'Dewi';
    perform pg_temp.cek('Dewi: kontrak waktu tertentu ditandai', a ->> 'kontrak_selesai' = '2027-06-30', a::text);
    perform pg_temp.cek('saldo awal 0', (r ->> 'saldo')::bigint = 0, r ->> 'saldo');
    perform public.atur_saldo_pesangon(12000000);
    perform pg_temp.cek('pemilik mengatur saldo cadangan', (public.cadangan_pesangon() ->> 'saldo')::bigint = 12000000);
    begin
      perform public.atur_saldo_pesangon(-1);
      perform pg_temp.cek('saldo negatif ditolak', false);
    exception when others then perform pg_temp.cek('saldo negatif ditolak', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;

    -- Bukan pemilik.
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.cadangan_pesangon();
      perform pg_temp.cek('admin tidak membaca angka per orang', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak membaca angka per orang', true);
    end;
    begin
      perform public.atur_saldo_pesangon(1);
      perform pg_temp.cek('admin tidak mengatur saldo', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak mengatur saldo', true);
    end;
    select count(*) into n from public.cadangan_pesangon;
    perform pg_temp.cek('admin tidak membaca tabel saldo', n = 0, n::text);
    perform set_config('request.jwt.claims', kk, true);
    begin
      perform public.cadangan_pesangon();
      perform pg_temp.cek('akuntan tidak membaca angka per orang', false);
    exception when insufficient_privilege then perform pg_temp.cek('akuntan tidak membaca angka per orang', true);
    end;
    perform set_config('request.jwt.claims', ks, true);
    begin
      perform public.cadangan_pesangon();
      perform pg_temp.cek('staf tidak membaca angka per orang', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak membaca angka per orang', true);
    end;

    -- Admin dengan klaim prn=pemilik (JWT basi, misalnya pemilik yang diturunkan) ditolak.
    perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
    begin
      perform public.cadangan_pesangon();
      perform pg_temp.cek('klaim prn=pemilik tanpa keanggotaan pemilik ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('klaim prn=pemilik tanpa keanggotaan pemilik ditolak', true);
    end;

    -- Usaha lain.
    perform set_config('request.jwt.claims', kb, true);
    r := public.cadangan_pesangon();
    perform pg_temp.cek('usaha lain: 0 orang, saldo 0', jsonb_array_length(r -> 'orang') = 0 and (r ->> 'saldo')::bigint = 0, r::text);
    select count(*) into n from public.cadangan_pesangon;
    perform pg_temp.cek('usaha lain tidak membaca saldo usaha A', n = 0, n::text);

    -- Anon.
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      perform public.cadangan_pesangon();
      perform pg_temp.cek('anon ditolak', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon ditolak', true);
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
