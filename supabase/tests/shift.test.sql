-- Tes F3-06 jadwal shift (docs/research/shift-f3-06-sql.md, shift-f3-06.md): batas PP 35/2021 dari pola kerja usaha (7 jam/hari pola
-- 6, 8 jam/hari pola 5, 40 jam/minggu), lembur > 4 jam/hari atau > 18 jam/minggu ditolak 54000, tumpang tindih mustahil (RPC dan
-- exclusion constraint), shift lewat tengah malam dihitung di tanggal mulai, peringatan tanpa istirahat dan kurang libur, persetujuan
-- lembur hanya dijawab orangnya, batal (bukan hapus) hanya untuk shift yang belum lewat, salin minggu idempoten, RLS dan isolasi.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; ks text; kd text; o_sari uuid; o_dewi uuid; u_sari uuid; u_dewi uuid;
  r jsonb; s1 uuid; n int; x text; v_hari date; v_senin date; v_depan date;
begin
  begin
    perform pg_temp.cek('tabel, fungsi, dan exclusion constraint ada', to_regclass('public.shift') is not null and to_regclass('public.persetujuan_lembur') is not null
      and to_regprocedure('public.simpan_shift(uuid,date,time,time,integer,uuid,uuid)') is not null
      and exists (select 1 from pg_constraint where conrelid = 'public.shift'::regclass and contype = 'x'));
    perform pg_temp.cek('tulis langsung dicabut; RPC lewat peran_aktif', not has_table_privilege('authenticated', 'public.shift', 'insert')
      and (select bool_and(prosrc ~ 'peran_aktif' and prosrc !~ 'app\.(prn|pengelola)\(\)') from pg_proc
        where oid in ('public.simpan_shift(uuid,date,time,time,integer,uuid,uuid)'::regprocedure, 'public.batal_shift(uuid)'::regprocedure, 'public.salin_jadwal(date,date)'::regprocedure)));

    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Shift', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Shift B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Shift') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Shift') returning id into o_dewi;
    perform public.buat_akun_staf(o_sari, '123456');
    perform public.buat_akun_staf(o_dewi, '123456');
    execute 'reset role';
    update public.perusahaan set zona_waktu = 'Asia/Jayapura' where id = pa;
    v_hari := app.hari_ini(pa);
    v_senin := (date_trunc('week', v_hari) + interval '7 days')::date;   -- minggu depan, semua tanggal belum lewat
    select user_id into u_sari from public.orang where id = o_sari;
    select user_id into u_dewi from public.orang where id = o_dewi;
    ks := json_build_object('sub', u_sari, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    kd := json_build_object('sub', u_dewi, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    -- 07.00-15.00 istirahat 60 = 7 jam (pola 6 bawaan): tanpa lembur.
    r := public.simpan_shift(o_sari, v_senin, '07:00', '15:00', 60, null, gen_random_uuid());
    s1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('shift 7 jam pola 6: tanpa peringatan, tanpa persetujuan lembur', jsonb_array_length(r -> 'peringatan') = 0
      and not exists (select 1 from public.persetujuan_lembur where shift_id = s1), r::text);
    perform pg_temp.cek('mulai_at/selesai_at di zona usaha', (select mulai_at = ((v_senin + time '07:00') at time zone 'Asia/Jayapura') from public.shift where id = s1));
    begin
      perform public.simpan_shift(o_sari, v_senin, '14:00', '18:00', 0, null, gen_random_uuid());
      perform pg_temp.cek('tumpang tindih ditolak', false);
    exception when others then perform pg_temp.cek('tumpang tindih ditolak', sqlstate = '23P01', sqlstate || ' ' || sqlerrm);
    end;
    -- Split shift sore boleh; 18.00-21.00 = 3 jam -> hari itu 10 jam -> lembur 3 jam, persetujuan dibuat.
    r := public.simpan_shift(o_sari, v_senin, '18:00', '21:00', 0, null, gen_random_uuid());
    perform pg_temp.cek('lembur 3 jam: persetujuan menunggu dibuat untuk orangnya', exists (select 1 from public.persetujuan_lembur p
      where p.shift_id = (r ->> 'id')::uuid and p.orang_id = o_sari and p.menit_lembur = 180 and p.status = 'menunggu'), r::text);
    begin
      perform public.simpan_shift(o_sari, v_senin, '21:30', '23:00', 0, null, gen_random_uuid());
      perform pg_temp.cek('lembur lebih dari 4 jam sehari ditolak', false);
    exception when others then perform pg_temp.cek('lembur lebih dari 4 jam sehari ditolak', sqlstate = '54000', sqlstate || ' ' || sqlerrm);
    end;
    -- Lewat tengah malam: 22.00-06.00 istirahat 60 = 7 jam di tanggal mulai (Selasa).
    r := public.simpan_shift(o_dewi, v_senin + 1, '22:00', '06:00', 60, null, gen_random_uuid());
    perform pg_temp.cek('shift lewat tengah malam = 7 jam, selesai esok hari', (select selesai_at - mulai_at = interval '8 hours' and tanggal = v_senin + 1
      from public.shift where id = (r ->> 'id')::uuid) and jsonb_array_length(r -> 'peringatan') = 0, r::text);
    -- Tanpa istirahat > 4 jam.
    r := public.simpan_shift(o_dewi, v_senin + 3, '08:00', '14:00', 0, null, gen_random_uuid());
    perform pg_temp.cek('peringatan tanpa istirahat (6 jam, istirahat 0)', r -> 'peringatan' ? 'tanpa_istirahat', r::text);
    -- Kurang libur: Dewi 7 hari kerja di minggu itu (pola 6 butuh 1 libur) -> peringatan di shift ketujuh.
    perform public.simpan_shift(o_dewi, v_senin + d, '08:00', '12:00', 0, null, gen_random_uuid()) from generate_series(0, 5) d where d not in (1, 3);
    r := public.simpan_shift(o_dewi, v_senin + 6, '08:00', '12:00', 0, null, gen_random_uuid());
    perform pg_temp.cek('peringatan kurang libur', r -> 'peringatan' ? 'kurang_libur', r::text);
    -- 18 jam lembur seminggu: Sari lembur 3 jam (Senin) + 3 x 4 jam = 15 jam diterima; hari kelima 4 jam lagi = 19 jam ditolak.
    for n in 1..3 loop
      perform public.simpan_shift(o_sari, v_senin + n, '07:00', '18:00', 0, null, gen_random_uuid());
    end loop;
    begin
      perform public.simpan_shift(o_sari, v_senin + 4, '07:00', '18:00', 0, null, gen_random_uuid());
      perform pg_temp.cek('lembur lebih dari 18 jam seminggu ditolak', false);
    exception when others then perform pg_temp.cek('lembur lebih dari 18 jam seminggu ditolak', sqlstate = '54000', sqlstate || ' ' || sqlerrm);
    end;

    -- Persetujuan lembur dijawab orangnya saja.
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.jawab_lembur((select id from public.persetujuan_lembur where orang_id = o_sari limit 1), true);
      perform pg_temp.cek('orang lain tidak bisa menjawab persetujuan lembur', false);
    exception when others then perform pg_temp.cek('orang lain tidak bisa menjawab persetujuan lembur', sqlstate in ('P0002', '42501'), sqlstate || ' ' || sqlerrm);
    end;
    select count(*) into n from public.shift where orang_id = o_sari;
    perform pg_temp.cek('staf hanya melihat shiftnya sendiri', n = 0 and (select count(*) from public.shift) > 0, n::text);
    begin
      perform public.simpan_shift(o_dewi, v_senin, '07:00', '08:00', 0, null, gen_random_uuid());
      perform pg_temp.cek('staf tidak bisa menyusun jadwal', false);
    exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menyusun jadwal', true);
    end;
    perform set_config('request.jwt.claims', ks, true);
    perform public.jawab_lembur((select id from public.persetujuan_lembur where orang_id = o_sari order by dibuat_at limit 1), true);
    perform pg_temp.cek('orangnya sendiri menyetujui lembur', exists (select 1 from public.persetujuan_lembur where orang_id = o_sari and status = 'setuju'));

    -- Batal, salin, idempoten.
    perform set_config('request.jwt.claims', ka, true);
    perform public.batal_shift(s1);
    perform pg_temp.cek('batal shift depan: status batal, baris tetap ada', (select status from public.shift where id = s1) = 'batal');
    r := public.simpan_shift(o_sari, v_senin, '07:00', '09:00', 0, null, gen_random_uuid());
    perform pg_temp.cek('jam yang dibatalkan bisa diisi lagi', (r ->> 'id') is not null);
    n := public.salin_jadwal(v_senin, v_senin + 7);
    perform pg_temp.cek('salin minggu: semua shift aktif tersalin, tanpa yang batal', n = (select count(*) from public.shift where perusahaan_id = pa and status = 'aktif'
      and tanggal between v_senin and v_senin + 6), n::text);
    perform pg_temp.cek('salin kedua kali tidak menggandakan', public.salin_jadwal(v_senin, v_senin + 7) = 0);
    x := gen_random_uuid()::text;
    perform public.simpan_shift(o_dewi, v_senin + 20, '07:00', '09:00', 0, null, x::uuid);
    perform pg_temp.cek('kunci klien sama: satu baris', (public.simpan_shift(o_dewi, v_senin + 20, '07:00', '09:00', 0, null, x::uuid) ->> 'sudah')::boolean
      and (select count(*) from public.shift where orang_id = o_dewi and tanggal = v_senin + 20) = 1);
    execute 'reset role';
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
      values (pa, o_dewi, v_hari - 3, '07:00', '09:00', 0, (v_hari - 3 + time '07:00') at time zone 'Asia/Jayapura', (v_hari - 3 + time '09:00') at time zone 'Asia/Jayapura', gen_random_uuid())
      returning id into s1;
    begin
      insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
        values (pa, o_dewi, v_hari - 3, '08:00', '10:00', 0, (v_hari - 3 + time '08:00') at time zone 'Asia/Jayapura', (v_hari - 3 + time '10:00') at time zone 'Asia/Jayapura', gen_random_uuid());
      perform pg_temp.cek('exclusion constraint menolak tumpang tindih walau lewat tulis langsung', false);
    exception when exclusion_violation then perform pg_temp.cek('exclusion constraint menolak tumpang tindih walau lewat tulis langsung', true);
    end;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    begin
      perform public.batal_shift(s1);
      perform pg_temp.cek('shift yang sudah lewat tidak bisa dibatalkan', false);
    exception when others then perform pg_temp.cek('shift yang sudah lewat tidak bisa dibatalkan', sqlstate = '22023', sqlstate || ' ' || sqlerrm);
    end;
    r := public.jadwal_minggu(v_senin);
    perform pg_temp.cek('jadwal_minggu: total menit kerja per orang', (select (e ->> 'menit')::int from jsonb_array_elements(r -> 'orang') e where e ->> 'nama' = 'Dewi Shift') > 0, left(r::text, 300));

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat shift', (select count(*) from public.shift) = 0);
    begin
      perform public.simpan_shift(o_sari, v_senin, '07:00', '08:00', 0, null, gen_random_uuid());
      perform pg_temp.cek('usaha lain tidak bisa menjadwal orang usaha A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak bisa menjadwal orang usaha A', sqlstate = 'P0002', sqlstate || ' ' || sqlerrm);
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
