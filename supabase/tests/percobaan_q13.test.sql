-- Tes Q-13 (docs/quality/keamanan-f0.md S6, S7, A7, A8): kode absen salah dicatat dan dikunci setelah 5 kali per orang per menit;
-- PIN staf salah dicatat per akun dan akun staf dikunci 15 menit setelah 5 kali; atur ulang PIN membuka kunci; akun email biasa
-- tidak tersentuh; sinyal cek wajah disimpan lengkap dan absen yang patut dicek muncul di absen_ragu. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; ks1 text; ks2 text; o1 uuid; o2 uuid; us1 uuid; us2 uuid; tp uuid;
  k bytea; t bigint; kode text; r jsonb; n int; i int; v_email text; v_ban timestamptz;
  wajah_lemah jsonb := '{"lulus": true, "kedip": false, "menoleh": ""}';
  wajah_baik jsonb := '{"lulus": true, "kedip": true, "menoleh": "kiri"}';
begin
  insert into auth.users (id, email) values (ua, 'pemilik-q13@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji Q13', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  tp := public.tempat_absen_utama();
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o2;
  perform public.buat_akun_staf(o1, '123456');
  perform public.buat_akun_staf(o2, '123456');
  execute 'reset role';
  select user_id into us1 from public.orang where id = o1;
  select user_id into us2 from public.orang where id = o2;
  select email into v_email from auth.users where id = us1;
  select rahasia into k from app.rahasia_tempat where tempat_id = tp;
  t := floor(extract(epoch from clock_timestamp()) / 15)::bigint;
  kode := app.totp(k, t * 15, 15, 6);
  execute 'set local role authenticated';
  ks1 := json_build_object('sub', us1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  ks2 := json_build_object('sub', us2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  -- S6: lima kode salah dicatat (dikembalikan sebagai galat, tidak dibatalkan), percobaan keenam dengan kode benar ditolak.
  perform set_config('request.jwt.claims', ks1, true);
  n := 0;
  for i in 1..5 loop
    begin
      r := public.absen_catat(tp, '000000', 'absen.masuk', wajah_baik);
      if r ? 'galat' then n := n + 1; end if;
    exception when others then null;
    end;
  end loop;
  perform pg_temp.cek('S6 kode salah dikembalikan sebagai galat (tercatat)', n = 5, n::text);
  begin
    r := public.absen_catat(tp, kode, 'absen.masuk', wajah_baik);
    perform pg_temp.cek('S6 setelah 5 kode salah semenit, absen ditolak sementara', false, r::text);
  exception when others then perform pg_temp.cek('S6 setelah 5 kode salah semenit, absen ditolak sementara', sqlstate = '54000', sqlerrm);
  end;

  -- Orang lain tidak ikut terkunci; sinyal wajah disimpan lengkap; absen lemah muncul di laporan.
  perform set_config('request.jwt.claims', ks2, true);
  begin
    r := public.absen_catat(tp, '111111', 'absen.masuk', wajah_lemah);
  exception when others then null;
  end;
  begin
    r := public.absen_catat(tp, kode, 'absen.masuk', wajah_lemah);
    perform pg_temp.cek('S6 orang lain tetap bisa absen', r ? 'saat', r::text);
  exception when others then perform pg_temp.cek('S6 orang lain tetap bisa absen', false, sqlerrm);
  end;
  execute 'reset role';
  select count(*) into n from public.kejadian where orang_id = o2 and jenis = 'absen.masuk' and data -> 'wajah' ->> 'lulus' = 'true' and (data ->> 'salah_sebelum')::int = 1;
  perform pg_temp.cek('A8 sinyal wajah dan kode salah sebelumnya disimpan', n = 1, n::text);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    select count(*) into n from public.absen_ragu(30) where orang_id = o2 and alasan like '%berkedip%';
    perform pg_temp.cek('A8 pemilik melihat absen dengan cek wajah lemah', n = 1, n::text);
  exception when others then perform pg_temp.cek('A8 pemilik melihat absen dengan cek wajah lemah', false, sqlerrm);
  end;

  -- S7: PIN salah dicatat per akun staf; terkunci setelah 5 kali; akun email biasa tidak tersentuh.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    for i in 1..5 loop r := public.pin_staf_gagal(v_email); end loop;
    perform pg_temp.cek('S7 lima PIN salah mengunci akun staf', (r ->> 'terkunci')::boolean, r::text);
    r := public.pin_staf_gagal('pemilik-q13@uji.local');
    perform pg_temp.cek('S7 akun email biasa tidak bisa dikunci lewat fungsi ini', not (r ->> 'terkunci')::boolean, r::text);
  exception when others then perform pg_temp.cek('S7 fungsi pencatat PIN salah ada untuk anon', false, sqlerrm);
  end;
  execute 'reset role';
  select banned_until into v_ban from auth.users where id = us1;
  perform pg_temp.cek('S7 akun staf diblokir sekitar 15 menit', v_ban between now() + interval '14 minutes' and now() + interval '16 minutes', coalesce(v_ban::text, 'null'));
  perform pg_temp.cek('S7 akun email biasa tidak diblokir', (select banned_until is null from auth.users where id = ua));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform public.buat_akun_staf(o1, '654321');
  execute 'reset role';
  perform pg_temp.cek('S7 atur ulang PIN oleh pemilik membuka kunci', (select banned_until is null from auth.users where id = us1));
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    r := public.pin_staf_gagal(v_email);
    perform pg_temp.cek('S7 hitungan mulai lagi setelah atur ulang', not (r ->> 'terkunci')::boolean and (r ->> 'sisa')::int = 4, r::text);
  exception when others then perform pg_temp.cek('S7 hitungan mulai lagi setelah atur ulang', false, sqlerrm);
  end;
  begin
    select count(*) into n from app.percobaan;
    perform pg_temp.cek('catatan percobaan tertutup dari API', false, n::text);
  exception when others then perform pg_temp.cek('catatan percobaan tertutup dari API', true);
  end;
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
