-- Tes F3-06C kebutuhan shift: atur untuk beberapa hari sekaligus (upsert, diaktifkan lagi), validasi, berhenti pakai tanpa hapus,
-- data penyusun (kebutuhan aktif, orang bertopi, shift malam 4 minggu lalu, hari yang sudah terisi), hak dan isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text;
  o_sari uuid; o_budi uuid; t_kasir uuid; t_b uuid; v_senin date; r jsonb; e jsonb; n int; k1 uuid;
begin
  begin
    perform pg_temp.cek('tabel dan fungsi ada, tulis langsung tidak diberikan', to_regclass('public.kebutuhan_shift') is not null
      and to_regprocedure('public.data_usulan_jadwal(date)') is not null and not has_table_privilege('authenticated', 'public.kebutuhan_shift', 'insert'));
    insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Kebutuhan', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Kebutuhan B', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', kb, true);
    insert into public.topi (perusahaan_id, kode, nama) values (pb, 'kasir_b_keb', 'Kasir B') returning id into t_b;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Kebutuhan') returning id into o_sari;
    insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Kebutuhan') returning id into o_budi;
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_keb_uji', 'Kasir Keb') returning id into t_kasir;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_kasir), (pa, o_budi, t_kasir);
    perform public.buat_akun_staf(o_sari, '123456');
    execute 'reset role';
    select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_sari;
    v_senin := (date_trunc('week', app.hari_ini(pa)) + interval '7 days')::date;
    -- Riwayat: Sari dua shift malam (22.00-06.00) dalam 4 minggu sebelum v_senin, satu shift malam 5 minggu lalu (tidak dihitung).
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, kunci_klien)
    select pa, o_sari, d, '22:00', '06:00', 60, (d + time '22:00') at time zone app.zona(pa), (d + 1 + time '06:00') at time zone app.zona(pa), gen_random_uuid()
      from unnest(array[v_senin - 3, v_senin - 10, v_senin - 35]) d;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    n := public.atur_kebutuhan(t_kasir, array[0, 1, 2, 3, 4, 5, 6], '07:00', '15:00', 60, 1);
    perform pg_temp.cek('kebutuhan 7 hari sekaligus', n = 7 and (select count(*) from public.kebutuhan_shift where aktif) = 7, n::text);
    n := public.atur_kebutuhan(t_kasir, array[5, 6], '07:00', '15:00', 60, 2);
    perform pg_temp.cek('hari sama diperbarui, bukan digandakan: Sabtu-Minggu butuh 2', n = 2 and (select count(*) from public.kebutuhan_shift) = 7
      and (select butuh from public.kebutuhan_shift where hari = 6) = 2);
    begin perform public.atur_kebutuhan(t_kasir, array[]::integer[], '07:00', '15:00', 0, 1); perform pg_temp.cek('tanpa hari ditolak', false);
    exception when others then perform pg_temp.cek('tanpa hari ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_kebutuhan(t_kasir, array[0], '07:00', '08:00', 90, 1); perform pg_temp.cek('istirahat lebih lama dari shift ditolak', false);
    exception when others then perform pg_temp.cek('istirahat lebih lama dari shift ditolak', sqlstate = '22023', sqlerrm); end;
    begin perform public.atur_kebutuhan(t_b, array[0], '07:00', '15:00', 0, 1); perform pg_temp.cek('topi usaha lain ditolak', false);
    exception when others then perform pg_temp.cek('topi usaha lain ditolak', sqlstate = 'P0002', sqlerrm); end;
    select id into k1 from public.kebutuhan_shift where hari = 3;
    perform public.henti_kebutuhan(k1);
    perform pg_temp.cek('berhenti pakai: baris tetap ada, tidak aktif', (select not aktif from public.kebutuhan_shift where id = k1) and (select count(*) from public.kebutuhan_shift) = 7);
    perform public.simpan_shift(o_budi, v_senin + 2, '07:00', '15:00', 60, t_kasir, gen_random_uuid());

    r := public.data_usulan_jadwal(v_senin + 3);
    perform pg_temp.cek('data penyusun: minggu mulai Senin, 6 kebutuhan aktif, pola usaha', (r ->> 'mulai')::date = v_senin
      and jsonb_array_length(r -> 'kebutuhan') = 6 and r ->> 'pola' in ('6_hari', '5_hari')
      and (r -> 'kebutuhan' -> 0 ->> 'topi_nama') = 'Kasir Keb' and (r -> 'kebutuhan' -> 0 ->> 'mulai') = '07:00', left(r::text, 400));
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Sari Kebutuhan';
    perform pg_temp.cek('Sari: bertopi kasir, 2 shift malam 4 minggu terakhir (5 minggu lalu tidak dihitung)', e -> 'topi' ? t_kasir::text
      and (e ->> 'malam_lalu')::int = 2, e::text);
    select x into e from jsonb_array_elements(r -> 'orang') x where x ->> 'nama' = 'Budi Kebutuhan';
    perform pg_temp.cek('Budi: Rabu (hari 2) sudah terisi', e -> 'hari_terisi' = '[2]'::jsonb and (e ->> 'malam_lalu')::int = 0, e::text);

    perform set_config('request.jwt.claims', ks, true);
    perform pg_temp.cek('staf tidak membaca kebutuhan', (select count(*) from public.kebutuhan_shift) = 0);
    begin perform public.data_usulan_jadwal(v_senin); perform pg_temp.cek('staf tidak meminta data penyusun', false);
    exception when others then perform pg_temp.cek('staf tidak meminta data penyusun', sqlstate = '42501', sqlerrm); end;
    begin perform public.atur_kebutuhan(t_kasir, array[0], '07:00', '15:00', 0, 1); perform pg_temp.cek('staf tidak mengatur kebutuhan', false);
    exception when others then perform pg_temp.cek('staf tidak mengatur kebutuhan', sqlstate = '42501', sqlerrm); end;

    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain: tidak melihat kebutuhan dan orang usaha A', (select count(*) from public.kebutuhan_shift) = 0
      and public.data_usulan_jadwal(v_senin)::text not like '%Kebutuhan%');
    begin perform public.henti_kebutuhan(k1); perform pg_temp.cek('usaha lain tidak menghentikan kebutuhan A', false);
    exception when others then perform pg_temp.cek('usaha lain tidak menghentikan kebutuhan A', sqlstate = 'P0002', sqlerrm); end;
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
