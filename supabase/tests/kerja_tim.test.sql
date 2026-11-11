-- Tes X-10 kerja tim (supabase/migrations/20261111132000_kerja_tim.sql): banyak pelaksana dengan porsi dan satu PIC, poin beban,
-- KPI, dan kolam bonus dibagi menurut porsi, checklist yang bisa dicentang semua pelaksana, isolasi usaha. Transaksi dibatalkan
-- di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ksari text; kbudi text; kdewi text;
  sari uuid; budi uuid; dewi uuid; orang_b uuid; k1 uuid; k2 uuid; b1 uuid; r jsonb; n int; v_senin date; x numeric; y numeric;
begin
  begin
    insert into auth.users (id, email) values (ua, 'tim-a@uji.local'), (ub, 'tim-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Agensi Tim Uji', 'kantor');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Usaha Lain Tim', 'kantor');
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pb, 'Orang B', array['karyawan']) returning id into orang_b;
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Sari Tim', array['karyawan']) returning id into sari;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Budi Tim', array['karyawan']) returning id into budi;
    insert into public.orang (perusahaan_id, nama, jenis) values (pa, 'Dewi Tim', array['karyawan']) returning id into dewi;
    perform public.buat_akun_staf(sari, '123456');
    perform public.buat_akun_staf(budi, '123456');
    perform public.buat_akun_staf(dewi, '123456');
    ksari := json_build_object('sub', (select user_id from public.orang where id = sari), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kbudi := json_build_object('sub', (select user_id from public.orang where id = budi), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kdewi := json_build_object('sub', (select user_id from public.orang where id = dewi), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    -- Jalur lama: buat_kerja dengan satu pelaksana menjadi satu baris 100% PIC.
    r := public.buat_kerja('Desain katalog', null, sari, null, null);
    k1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('kerja lama: satu pelaksana 100% sebagai PIC',
      (select count(*) = 1 and bool_and(porsi = 100 and pic and orang_id = sari) from public.kerja_pelaksana where kerja_id = k1));
    r := public.buat_kerja('Rapat klien', null, dewi, null, null);
    k2 := (r ->> 'id')::uuid;

    -- Atur tim: Sari 60% PIC, Budi 40%.
    r := public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 60, 'pic', true), jsonb_build_object('orang_id', budi, 'porsi', 40)));
    perform pg_temp.cek('tim dua orang tersimpan, PIC menjadi pelaksana_id',
      (select count(*) from public.kerja_pelaksana where kerja_id = k1) = 2 and (select pelaksana_id from public.kerja where id = k1) = sari, r::text);
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 60, 'pic', true), jsonb_build_object('orang_id', budi, 'porsi', 30)));
      perform pg_temp.cek('porsi tidak 100 ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('porsi tidak 100 ditolak', true); end;
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 50, 'pic', true), jsonb_build_object('orang_id', budi, 'porsi', 50, 'pic', true)));
      perform pg_temp.cek('dua PIC ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('dua PIC ditolak', true); end;
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 50, 'pic', true), jsonb_build_object('orang_id', orang_b, 'porsi', 50)));
      perform pg_temp.cek('orang usaha lain ditolak', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('orang usaha lain ditolak', true); end;
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 50, 'pic', true), jsonb_build_object('orang_id', sari, 'porsi', 50)));
      perform pg_temp.cek('orang ganda ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('orang ganda ditolak', true); end;
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', sari, 'porsi', 99.5, 'pic', true), jsonb_build_object('orang_id', budi, 'porsi', 0.5)));
      perform pg_temp.cek('porsi pecahan ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('porsi pecahan ditolak', true); end;

    -- Staf: Budi (anggota tim) melihat dan menjalankan kerja; Dewi tidak melihat kerja k1; staf tidak bisa mengatur tim.
    perform set_config('request.jwt.claims', kbudi, true);
    perform pg_temp.cek('pelaksana bersama melihat kerja dan timnya', (select count(*) from public.kerja where id = k1) = 1 and (select count(*) from public.kerja_pelaksana where kerja_id = k1) = 2);
    r := public.papan_kerja();
    perform pg_temp.cek('papan kerja Budi: saya, tim 2 orang', exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k1 and (e ->> 'saya')::boolean
      and jsonb_array_length(e -> 'tim') = 2), r::text);
    begin perform public.atur_pelaksana_kerja(k1, jsonb_build_array(jsonb_build_object('orang_id', budi, 'porsi', 100, 'pic', true)));
      perform pg_temp.cek('staf tidak bisa mengatur tim', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa mengatur tim', true); end;
    perform set_config('request.jwt.claims', ksari, true);
    r := public.tambah_butir_kerja(k1, 'Buat layout');
    b1 := (r ->> 'id')::uuid;
    perform public.tambah_butir_kerja(k1, 'Cek di HP');
    perform set_config('request.jwt.claims', kbudi, true);
    r := public.centang_butir_kerja(b1, true);
    perform pg_temp.cek('pelaksana lain mencentang butir buatan PIC (temuan X-08)', (select selesai from public.kerja_butir where id = b1), r::text);
    r := public.papan_kerja();
    perform pg_temp.cek('progres butir 1 dari 2', exists (select 1 from jsonb_array_elements(r) e where (e ->> 'id')::uuid = k1 and e -> 'butir' = '{"selesai": 1, "total": 2}'::jsonb), r::text);
    begin perform public.batal_butir_kerja(b1); perform pg_temp.cek('staf tidak membatalkan butir buatan orang lain', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membatalkan butir buatan orang lain', true); end;
    perform public.ubah_status_kerja(k1, 'mulai');
    perform pg_temp.cek('pelaksana bersama bisa memulai kerja', (select status from public.kerja where id = k1) = 'jalan');
    perform set_config('request.jwt.claims', kdewi, true);
    perform pg_temp.cek('staf di luar tim tidak melihat kerja, tim, atau butirnya',
      (select count(*) from public.kerja where id = k1) = 0 and (select count(*) from public.kerja_pelaksana where kerja_id = k1) = 0 and (select count(*) from public.kerja_butir where kerja_id = k1) = 0);
    begin perform public.centang_butir_kerja(b1, false); perform pg_temp.cek('staf di luar tim tidak bisa mencentang', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('staf di luar tim tidak bisa mencentang', true); end;
    begin perform public.ubah_status_kerja(k1, 'selesai'); perform pg_temp.cek('staf di luar tim tidak bisa menyelesaikan', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('staf di luar tim tidak bisa menyelesaikan', true); end;
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat tim dan butir', (select count(*) from public.kerja_pelaksana) = 0 and (select count(*) from public.kerja_butir) = 0);
    begin perform public.tambah_butir_kerja(k1, 'Susup'); perform pg_temp.cek('usaha lain tidak bisa menambah butir', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa menambah butir', true); end;
    execute 'reset role';

    -- Poin dibagi menurut porsi: kerja 10 poin -> Sari 6, Budi 4; kerja satu pelaksana tetap utuh.
    update public.kerja set poin_beban = 10 where id = k1;
    update public.kerja set poin_beban = 5, status = 'jalan', mulai_at = now() where id = k2;
    v_senin := date_trunc('week', app.hari_ini(pa))::date;
    select poin into x from app.beban_orang(pa, v_senin) where orang_id = sari;
    select poin into y from app.beban_orang(pa, v_senin) where orang_id = budi;
    perform pg_temp.cek('beban: Sari 6, Budi 4', x = 6 and y = 4, x || ' ' || y);
    select poin into x from app.beban_orang(pa, v_senin) where orang_id = dewi;
    perform pg_temp.cek('beban kerja satu pelaksana tetap utuh (5)', x = 5, x::text);
    update public.kerja set status = 'selesai', selesai_at = now() where id = k1;
    select poin_selesai into x from app.kpi_orang(pa, v_senin) where orang_id = sari;
    select poin_selesai into y from app.kpi_orang(pa, v_senin) where orang_id = budi;
    perform pg_temp.cek('KPI poin selesai dibagi porsi', x = 6 and y = 4, x || ' ' || y);
    select selesai_n into n from app.kpi_orang(pa, v_senin) where orang_id = budi;
    perform pg_temp.cek('KPI menghitung kerja tim sekali untuk tiap anggota', n = 1, n::text);
    select sum(poin) into x from app.kolam_poin(pa, now() - interval '1 day', now() + interval '1 day', '[]') where orang_id in (sari, budi);
    perform pg_temp.cek('kolam bonus membagi poin kerja tim (jumlah tetap 10)', x = 10, x::text);

    -- PIC diganti langsung ke orang di luar tim (jalur lama): tim diganti satu pelaksana baru 100%.
    update public.kerja set pelaksana_id = dewi where id = k1;
    perform pg_temp.cek('ganti pelaksana_id ke luar tim: satu pelaksana 100%',
      (select count(*) = 1 and bool_and(orang_id = dewi and porsi = 100 and pic) from public.kerja_pelaksana where kerja_id = k1 and lepas_at is null));
    perform pg_temp.cek('anggota lama tidak dihapus: tercatat lepas dari tim',
      (select count(*) = 2 and bool_and(lepas_at is not null and not pic) from public.kerja_pelaksana where kerja_id = k1 and orang_id in (sari, budi)));
    perform pg_temp.cek('kebijakan baru memakai keanggotaan aktif (Q-21)', not exists (select 1 from pg_policies where tablename in ('kerja_pelaksana', 'kerja_butir', 'kerja')
      and cmd = 'SELECT' and coalesce(qual, '') !~ 'anggota_aktif'));
  exception when others then
    perform pg_temp.cek('blok tes berjalan sampai akhir', false, sqlstate || ' ' || sqlerrm);
  end;
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES % | gagal=[%]', (select count(*) from _t where ok), coalesce(g, '');
end $$;
