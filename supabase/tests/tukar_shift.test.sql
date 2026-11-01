-- Tes F3-06B tukar shift: tawarkan shift sendiri yang belum mulai; rekan bertopi sama mengambil dengan cek batas PP 35/2021
-- (lembur > 4 jam ditolak 54000, peringatan butuh konfirmasi); dua pengambil, yang pertama menang; staf lain tidak membaca
-- tawaran; usulan shift.tukar di Feed untuk pemilik; disetujui = shift berpindah dan persetujuan lembur tercatat atas nama
-- pengambil; ditolak = shift tetap; shift yang sudah mulai tidak bisa ditawarkan; usaha lain tidak melihat apa pun.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_tono uuid; t_kasir uuid; k_sari text; k_budi text; k_dewi text; k_tono text;
  v_senin date; s_sen uuid; s_sel uuid; s_lalu uuid; r jsonb; t1 uuid; t2 uuid; v_u uuid; k1 uuid := gen_random_uuid(); n int; x text;
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada, tulis langsung tidak diberikan', to_regclass('public.tawaran_shift') is not null
      and to_regprocedure('public.ambil_tawaran(uuid,boolean)') is not null and not has_table_privilege('authenticated', 'public.tawaran_shift', 'insert'));
    perform pg_temp.cek('status persetujuan lembur menerima batal', pg_get_constraintdef((select oid from pg_constraint where conname = 'persetujuan_lembur_status_check')) like '%batal%');

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Tukar', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Tukar B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Tukar') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Tukar') returning id into o_budi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Tukar') returning id into o_dewi;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Tono Tukar') returning id into o_tono;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_tukar_uji', 'Kasir Tukar') returning id into t_kasir;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_kasir), (pa, o_budi, t_kasir), (pa, o_tono, t_kasir);
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_budi, '123456');
    perform public.buat_akun_staf(o_dewi, '123456');
    perform public.buat_akun_staf(o_tono, '123456');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_sari from public.orang where id = o_sari;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_budi from public.orang where id = o_budi;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_dewi from public.orang where id = o_dewi;
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into k_tono from public.orang where id = o_tono;
    v_senin := (date_trunc('week', app.hari_ini(pa)) + interval '7 days')::date;
    -- Shift Sari kemarin (sudah lewat), ditulis langsung sebagai data uji.
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, topi_id, kunci_klien)
    values (pa, o_sari, app.hari_ini(pa) - 1, '07:00', '15:00', 60, ((app.hari_ini(pa) - 1) + time '07:00') at time zone app.zona(pa),
            ((app.hari_ini(pa) - 1) + time '15:00') at time zone app.zona(pa), t_kasir, gen_random_uuid()) returning id into s_lalu;

    -- Pemilik: Sari Senin 07-15 istirahat 60 (7 jam, kasir) dan Selasa sama; Budi Senin 16-20 (4 jam); Tono Senin 15-22 (7 jam).
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    s_sen := (public.simpan_shift(o_sari, v_senin, '07:00', '15:00', 60, t_kasir, gen_random_uuid()) ->> 'id')::uuid;
    s_sel := (public.simpan_shift(o_sari, v_senin + 1, '07:00', '15:00', 60, t_kasir, gen_random_uuid()) ->> 'id')::uuid;
    perform public.simpan_shift(o_budi, v_senin, '16:00', '20:00', 0, null, gen_random_uuid());
    perform public.simpan_shift(o_tono, v_senin, '15:00', '22:00', 0, null, gen_random_uuid());

    perform set_config('request.jwt.claims', k_sari, true);
    r := public.tawarkan_shift(s_sen, k1);
    t1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('Sari menawarkan shift Senin', t1 is not null and not (r ->> 'sudah')::boolean, r::text);
    perform pg_temp.cek('kunci sama dan tawaran kedua untuk shift sama: tawaran yang sama', (public.tawarkan_shift(s_sen, k1) ->> 'id')::uuid = t1
      and (public.tawarkan_shift(s_sen, gen_random_uuid()) ->> 'id')::uuid = t1);
    begin perform public.tawarkan_shift(s_lalu, gen_random_uuid()); perform pg_temp.cek('shift yang sudah lewat tidak bisa ditawarkan', false);
    exception when others then perform pg_temp.cek('shift yang sudah lewat tidak bisa ditawarkan', sqlstate = '22023', sqlerrm); end;
    perform pg_temp.cek('jadwal_saya membawa id dan status tawaran', exists (select 1 from jsonb_array_elements(public.jadwal_saya(v_senin) -> 'shift') e
      where (e ->> 'id')::uuid = s_sen and e ->> 'tawaran' = 'terbuka'));

    perform set_config('request.jwt.claims', k_budi, true);
    begin perform public.tawarkan_shift(s_sel, gen_random_uuid()); perform pg_temp.cek('Budi tidak bisa menawarkan shift Sari', false);
    exception when others then perform pg_temp.cek('Budi tidak bisa menawarkan shift Sari', sqlstate = 'P0002', sqlerrm); end;
    begin perform public.batal_tawaran(t1); perform pg_temp.cek('Budi tidak bisa membatalkan tawaran Sari', false);
    exception when others then perform pg_temp.cek('Budi tidak bisa membatalkan tawaran Sari', sqlstate = 'P0002', sqlerrm); end;
    perform pg_temp.cek('Budi (kasir) melihat tawaran dari Sari', exists (select 1 from jsonb_array_elements(public.tawaran_saya() -> 'untuk') e
      where (e ->> 'id')::uuid = t1 and e ->> 'dari' = 'Sari Tukar'));

    perform set_config('request.jwt.claims', k_dewi, true);
    perform pg_temp.cek('Dewi (bukan kasir) tidak melihat tawaran dan tidak membaca barisnya', jsonb_array_length(public.tawaran_saya() -> 'untuk') = 0
      and (select count(*) from public.tawaran_shift) = 0);
    begin perform public.ambil_tawaran(t1, true); perform pg_temp.cek('Dewi tidak bisa mengambil', false);
    exception when others then perform pg_temp.cek('Dewi tidak bisa mengambil', sqlstate = 'P0002', sqlerrm); end;

    perform set_config('request.jwt.claims', k_tono, true);
    begin perform public.ambil_tawaran(t1, true); perform pg_temp.cek('Tono jadi lembur 7 jam: ditolak 54000', false);
    exception when others then perform pg_temp.cek('Tono jadi lembur 7 jam: ditolak 54000', sqlstate = '54000' and sqlerrm like '%lembur 7 jam%', sqlerrm); end;
    -- Dibaca sebagai pemilik: RLS staf hanya menampilkan shift dan tawaran miliknya.
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('penolakan simulasi tidak memindah shift', (select orang_id from public.shift where id = s_sen) = o_sari);

    perform set_config('request.jwt.claims', k_sari, true);
    begin perform public.ambil_tawaran(t1, true); perform pg_temp.cek('Sari tidak mengambil shiftnya sendiri', false);
    exception when others then perform pg_temp.cek('Sari tidak mengambil shiftnya sendiri', sqlstate = '22023', sqlerrm); end;

    perform set_config('request.jwt.claims', k_budi, true);
    r := public.ambil_tawaran(t1, false);
    perform pg_temp.cek('Budi tanpa konfirmasi: peringatan lembur 4 jam, belum diambil', r ->> 'status' = 'perlu_konfirmasi'
      and r -> 'peringatan' ? 'lembur' and (r ->> 'lembur_menit')::int = 240, r::text);
    perform set_config('request.jwt.claims', ka, true);
    perform pg_temp.cek('tanpa konfirmasi tawaran tetap terbuka', (select status from public.tawaran_shift where id = t1) = 'terbuka');
    perform set_config('request.jwt.claims', k_budi, true);
    r := public.ambil_tawaran(t1, true);
    v_u := (r ->> 'usulan_id')::uuid;
    perform pg_temp.cek('Budi dengan konfirmasi: diambil, usulan shift.tukar dibuat', r ->> 'status' = 'diambil'
      and (select status = 'diambil' and diambil_oleh = o_budi and lembur_menit = 240 from public.tawaran_shift where id = t1), r::text);
    execute 'reset role';
    select judul into x from public.usulan where id = v_u;
    perform pg_temp.cek('usulan untuk pemilik dengan kalimat jelas', (select aksi = 'shift.tukar' and 'pemilik' = any(untuk_peran) and status = 'menunggu' from public.usulan where id = v_u)
      and x = format('Sari Tukar menukar shift %s 07.00-15.00 ke Budi Tukar. Budi Tukar jadi 11 jam minggu ini.', app.tanggal_pendek(v_senin)), x);
    execute 'set local role authenticated';

    perform set_config('request.jwt.claims', k_tono, true);
    begin perform public.ambil_tawaran(t1, true); perform pg_temp.cek('pengambil kedua kalah: sudah diambil Budi', false);
    exception when others then perform pg_temp.cek('pengambil kedua kalah: sudah diambil Budi', sqlstate = '55000' and sqlerrm = 'Sudah diambil Budi Tukar.', sqlerrm); end;
    perform set_config('request.jwt.claims', k_sari, true);
    begin perform public.batal_tawaran(t1); perform pg_temp.cek('setelah diambil, penawar tidak bisa membatalkan', false);
    exception when others then perform pg_temp.cek('setelah diambil, penawar tidak bisa membatalkan', sqlstate = '22023', sqlerrm); end;
    perform pg_temp.cek('Sari membaca tawarannya sendiri', (select count(*) from public.tawaran_shift where id = t1) = 1);

    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan(v_u, true);
    perform pg_temp.cek('disetujui: shift Senin milik Budi, tawaran disetujui', (select orang_id from public.shift where id = s_sen) = o_budi
      and (select status from public.tawaran_shift where id = t1) = 'disetujui');
    perform pg_temp.cek('persetujuan lembur 4 jam tercatat atas nama Budi (diambil sendiri)',
      (select orang_id = o_budi and status = 'setuju' and menit_lembur = 240 and dijawab_at is not null from public.persetujuan_lembur where shift_id = s_sen));
    perform set_config('request.jwt.claims', k_budi, true);
    perform pg_temp.cek('jadwal Budi bertambah', exists (select 1 from jsonb_array_elements(public.jadwal_saya(v_senin) -> 'shift') e where (e ->> 'id')::uuid = s_sen));
    perform set_config('request.jwt.claims', k_sari, true);
    perform pg_temp.cek('jadwal Sari berkurang', not exists (select 1 from jsonb_array_elements(public.jadwal_saya(v_senin) -> 'shift') e where (e ->> 'id')::uuid = s_sen));

    -- Ditolak: shift Selasa tetap milik Sari.
    t2 := (public.tawarkan_shift(s_sel, gen_random_uuid()) ->> 'id')::uuid;
    perform set_config('request.jwt.claims', k_budi, true);
    r := public.ambil_tawaran(t2, false);
    perform pg_temp.cek('tanpa peringatan: langsung diambil', r ->> 'status' = 'diambil', r::text);
    perform set_config('request.jwt.claims', ka, true);
    perform public.putuskan_usulan((r ->> 'usulan_id')::uuid, false);
    perform pg_temp.cek('ditolak: shift tetap milik Sari, tawaran ditolak', (select orang_id from public.shift where id = s_sel) = o_sari
      and (select status from public.tawaran_shift where id = t2) = 'ditolak');

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat tawaran', (select count(*) from public.tawaran_shift) = 0);
    begin perform public.ambil_tawaran(t2, true); perform pg_temp.cek('pemilik usaha lain tidak mengambil', false);
    exception when others then perform pg_temp.cek('pemilik usaha lain tidak mengambil', sqlstate in ('42501', 'P0002'), sqlerrm); end;
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
