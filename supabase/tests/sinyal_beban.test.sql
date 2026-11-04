-- Tes sinyal beban (F3-07B): berat 3 minggu berturut-turut menyala, 2 minggu tidak, tim 2 orang tidak, lintas 0 -> 1 tidak,
-- izin sakit hanya dihitung bila riwayat >= 16 minggu, kartu hanya untuk pemilik dan idempoten per orang per minggu, teks tanpa
-- kata berisiko/keluar dan tanpa alasan sakit, staf/admin/pemilik yang dicabut ditolak 42501. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

-- Satu kerja selesai di minggu ke-w sebelum p_senin (zona usaha).
create function pg_temp.kerja(p_pid uuid, p_orang uuid, p_topi uuid, p_senin date, w int, p_poin numeric) returns void
language sql as $$
  insert into public.kerja (perusahaan_id, judul, topi_id, pelaksana_id, status, poin_beban, mulai_at, selesai_at, dibuat_at)
  select p_pid, 'Kerja uji', p_topi, p_orang, 'selesai', p_poin, m + interval '1 day', m + interval '1 day 1 hour', m + interval '1 day'
    from (select ((p_senin - 7 * w)::timestamp at time zone p.zona_waktu) as m from public.perusahaan p where p.id = p_pid) x
$$;

do $$
declare
  ua uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); uadm uuid := gen_random_uuid();
  pa uuid; pc uuid; pd uuid; ka text; kadm text; ks text; us uuid; senin date;
  o_sari uuid; o_budi uuid; o_dewi uuid; o_tono uuid; o_x uuid; o_y uuid; o_z uuid; o_p uuid; o_q uuid;
  t_kasir uuid; t_cuci uuid; t_c uuid; t_d uuid; r jsonb; n int; w int; u record; kartu uuid;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (uc, 'c@uji.local'), (ud, 'd@uji.local'), (uadm, 'adm@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Sinyal A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  pc := public.buat_perusahaan('Warung Sinyal C', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
  pd := public.buat_perusahaan('Warung Sinyal D', 'fnb');
  execute 'reset role';

  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'kasir_sinyal', 'Kasir Sinyal') returning id into t_kasir;
  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'cuci_sinyal', 'Cuci Sinyal') returning id into t_cuci;
  insert into public.topi (perusahaan_id, kode, nama) values (pc, 'kasir_sinyal_c', 'Kasir C') returning id into t_c;
  insert into public.topi (perusahaan_id, kode, nama) values (pd, 'kasir_sinyal_d', 'Kasir D') returning id into t_d;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Sinyal') returning id into o_sari;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Sinyal') returning id into o_budi;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Dewi Sinyal') returning id into o_dewi;
  insert into public.orang (perusahaan_id, nama, dibuat_at) values (pa, 'Tono Sinyal', now() - interval '20 weeks') returning id into o_tono;
  insert into public.orang (perusahaan_id, nama) values (pc, 'X Sinyal') returning id into o_x;
  insert into public.orang (perusahaan_id, nama) values (pc, 'Y Sinyal') returning id into o_y;
  insert into public.orang (perusahaan_id, nama) values (pc, 'Z Sinyal') returning id into o_z;
  insert into public.orang (perusahaan_id, nama) values (pd, 'P Sinyal') returning id into o_p;
  insert into public.orang (perusahaan_id, nama) values (pd, 'Q Sinyal') returning id into o_q;
  insert into public.pakai_topi (perusahaan_id, orang_id, topi_id, mulai) values
    (pa, o_sari, t_kasir, current_date - 200), (pa, o_budi, t_kasir, current_date - 200), (pa, o_dewi, t_kasir, current_date - 200),
    (pa, o_tono, t_cuci, current_date - 200), (pc, o_x, t_c, current_date - 200), (pc, o_y, t_c, current_date - 200),
    (pc, o_z, t_c, current_date - 200), (pd, o_p, t_d, current_date - 200), (pd, o_q, t_d, current_date - 200);
  senin := date_trunc('week', app.hari_ini(pa))::date;

  -- A, 3 minggu terakhir: Sari 9 + 1 lintas (cuci), Budi 3, Dewi 3, Tono 3 + 1 lintas (kasir). Rata 5, Sari 10 = 2,0 kali.
  for w in 1..3 loop
    perform pg_temp.kerja(pa, o_sari, t_kasir, senin, w, 9); perform pg_temp.kerja(pa, o_sari, t_cuci, senin, w, 1);
    perform pg_temp.kerja(pa, o_budi, t_kasir, senin, w, 3); perform pg_temp.kerja(pa, o_dewi, t_kasir, senin, w, 3);
    perform pg_temp.kerja(pa, o_tono, t_cuci, senin, w, 3); perform pg_temp.kerja(pa, o_tono, t_kasir, senin, w, 1);
  end loop;
  -- Budi satu kerja lintas topi saja (0 -> 1, tidak menyala). Dewi dan Budi punya kerja di minggu 4-6 juga.
  perform pg_temp.kerja(pa, o_budi, t_cuci, senin, 1, 1);
  for w in 4..6 loop perform pg_temp.kerja(pa, o_dewi, t_kasir, senin, w, 3); perform pg_temp.kerja(pa, o_budi, t_kasir, senin, w, 3); end loop;
  -- Tono: 4 hari sakit disetujui di 4 minggu terakhir, riwayat 20 minggu; Sari: 4 hari sakit tapi riwayat < 16 minggu.
  insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, alasan, status, alasan_putusan, diajukan_oleh) values
    (pa, o_tono, 'sakit', senin - 10, senin - 7, 4, 'Demam rahasia uji', 'disetujui', 'Disetujui pemilik', ua),
    (pa, o_sari, 'sakit', senin - 10, senin - 7, 4, 'Demam rahasia uji', 'disetujui', 'Disetujui pemilik', ua);
  -- C: X berat hanya 2 minggu. D: tim 2 orang.
  for w in 1..2 loop perform pg_temp.kerja(pc, o_x, t_c, senin, w, 10); perform pg_temp.kerja(pc, o_y, t_c, senin, w, 2); perform pg_temp.kerja(pc, o_z, t_c, senin, w, 2); end loop;
  perform pg_temp.kerja(pc, o_x, t_c, senin, 3, 2); perform pg_temp.kerja(pc, o_y, t_c, senin, 3, 2); perform pg_temp.kerja(pc, o_z, t_c, senin, 3, 2);
  for w in 1..3 loop perform pg_temp.kerja(pd, o_p, t_d, senin, w, 10); perform pg_temp.kerja(pd, o_q, t_d, senin, w, 2); end loop;

  select to_jsonb(s) into r from app.sinyal_beban(pa, senin) s where s.orang_id = o_sari;
  perform pg_temp.cek('Sari berat 3 minggu', (r ->> 'berat')::boolean and (r ->> 'nyala')::boolean, r::text);
  perform pg_temp.cek('Sari rasio 2,0', (r ->> 'rasio')::numeric = 2.0, r ->> 'rasio');
  perform pg_temp.cek('Sari lintas 3 kerja dari 0', (r ->> 'lintas')::boolean, r::text);
  perform pg_temp.cek('Sari sakit tidak dihitung (riwayat < 16 minggu)', not (r ->> 'sakit_dihitung')::boolean and not (r ->> 'sakit')::boolean);
  select to_jsonb(s) into r from app.sinyal_beban(pa, senin) s where s.orang_id = o_tono;
  perform pg_temp.cek('Tono lintas + sakit menyala tanpa berat', not (r ->> 'berat')::boolean and (r ->> 'lintas')::boolean and (r ->> 'sakit')::boolean and (r ->> 'nyala')::boolean, r::text);
  select to_jsonb(s) into r from app.sinyal_beban(pa, senin) s where s.orang_id = o_budi;
  perform pg_temp.cek('Budi lintas 0 -> 1 tidak menyala', not (r ->> 'lintas')::boolean and not (r ->> 'nyala')::boolean, r::text);
  select to_jsonb(s) into r from app.sinyal_beban(pc, senin) s where s.orang_id = o_x;
  perform pg_temp.cek('X berat 2 minggu saja tidak', not (r ->> 'berat')::boolean and not (r ->> 'nyala')::boolean, r::text);
  select to_jsonb(s) into r from app.sinyal_beban(pd, senin) s where s.orang_id = o_p;
  perform pg_temp.cek('tim 2 orang tidak', not (r ->> 'berat')::boolean, r::text);

  n := app.buat_kartu_beban(pa, senin);
  perform pg_temp.cek('dua kartu dibuat (Sari, Tono)', n = 2, n::text);
  perform pg_temp.cek('idempoten: jalan kedua 0 kartu', app.buat_kartu_beban(pa, senin) = 0);
  perform pg_temp.cek('kartu C dan D tidak ada', app.buat_kartu_beban(pc, senin) = 0 and app.buat_kartu_beban(pd, senin) = 0);
  for u in select * from public.usulan where perusahaan_id = pa and aksi = 'info.beban_tim' loop
    perform pg_temp.cek('kartu hanya pemilik: ' || u.judul, u.untuk_peran = '{pemilik}', u.untuk_peran::text);
    perform pg_temp.cek('teks tanpa kata berisiko/keluar/alasan sakit', (u.judul || ' ' || u.penjelasan) !~* '(berisiko|keluar|resign|demam|rahasia)', u.penjelasan);
  end loop;
  perform pg_temp.cek('judul Sari berangka', exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Sari Sinyal memikul 2,0 kali beban rata-rata tim, 3 minggu berturut-turut.'),
    (select string_agg(judul, ' | ') from public.usulan where perusahaan_id = pa and aksi = 'info.beban_tim'));
  perform pg_temp.cek('kartu Tono menyebut hari sakit', exists (select 1 from public.usulan where perusahaan_id = pa and aksi = 'info.beban_tim' and penjelasan like '%4 hari sakit dalam 4 minggu%'));
  select id into kartu from public.usulan where perusahaan_id = pa and aksi = 'info.beban_tim' and payload ->> 'orang_id' = o_sari::text;

  -- Hak: pemilik membaca sinyal; admin, staf, dan pemilik yang dicabut (JWT lama) ditolak.
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uadm, 'admin');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kadm := json_build_object('sub', uadm, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('pemilik membaca sinyal', jsonb_array_length(public.sinyal_beban_tim(senin)) = 2);
  perform public.buat_akun_staf(o_budi, '123456');
  select user_id into us from public.orang where id = o_budi;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', kadm, true);
  begin perform public.sinyal_beban_tim(senin); perform pg_temp.cek('admin ditolak', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin ditolak', true); end;
  perform pg_temp.cek('admin tidak melihat kartu', not exists (select 1 from public.usulan where aksi = 'info.beban_tim'));
  begin perform public.tandai_ditangani(kartu); perform pg_temp.cek('admin tidak bisa menutup kartu', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak bisa menutup kartu', true); end;
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.sinyal_beban_tim(senin); perform pg_temp.cek('staf ditolak', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf ditolak', true); end;
  perform set_config('request.jwt.claims', ka, true);
  perform public.tandai_ditangani(kartu);
  perform pg_temp.cek('pemilik menutup kartu', (select status = 'diterima' and diputuskan_oleh = ua from public.usulan where id = kartu));
  execute 'reset role';
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = ua;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.sinyal_beban_tim(senin); perform pg_temp.cek('pemilik dicabut (JWT lama) ditolak', false);
  exception when sqlstate '42501' then perform pg_temp.cek('pemilik dicabut (JWT lama) ditolak', true); end;
  execute 'reset role';
  perform pg_temp.cek('anon tidak bisa memanggil sinyal', not has_function_privilege('anon', 'public.sinyal_beban_tim(date)', 'execute'));
  perform pg_temp.cek('cron Senin terdaftar', exists (select 1 from cron.job where jobname = 'nadi-kartu-beban'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'sinyal_beban: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
