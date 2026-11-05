-- Tes M-14 rekrutmen lanjutan (supabase/migrations/20261105083000_rekrut_lanjutan.sql): sumber pelamar sekali dan hanya 2 jam, rincian
-- lowongan untuk JobPosting, jadwal wawancara (validasi, idempoten, tahap masuk jadi ditinjau, bentrok dihitung, batal), jadwal tampil
-- di status pelamar, laporan rekrutmen (tahap, sumber, hari sampai terisi, biaya per pelamar), rencana kebutuhan orang (terisi dari topi),
-- peran dan isolasi. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid;
  lw uuid; v_kode text; la uuid; la2 uuid; la3 uuid; tok text; r jsonb; s1 uuid; k uuid := gen_random_uuid(); tp uuid; v_hari date; t0 timestamptz;
begin
  begin
    insert into auth.users (id, email) values (ua, 'rl.a@uji.local'), (ub, 'rl.b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Rekrut', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Lain Uji Rekrut', 'toko');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Lama') returning id into o_s;
    perform public.buat_akun_staf(o_s, '454545');
    execute 'reset role';
    insert into public.topi (perusahaan_id, kode, nama) values (pa, 'pelayan_uji', 'Pelayan uji') returning id into tp;
    insert into public.lowongan (perusahaan_id, judul, topi_id, biaya_iklan) values (pa, 'Pelayan shift malam', tp, 150000) returning id, kode into lw, v_kode;
    insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_s, tp);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);

    perform public.save_job_details(lw, '{"kota": "Denpasar", "wilayah": "Bali", "jenis": "PART_TIME", "gaji_min": 2500000, "gaji_max": 3000000, "gaji_satuan": "MONTH", "terindeks": true}');
    begin perform public.save_job_details(lw, '{"terindeks": true}'); perform pg_temp.cek('terindeks tanpa kota ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('terindeks tanpa kota ditolak', true); end;
    begin perform public.save_job_details(lw, '{"kota": "Denpasar", "gaji_min": 3000000, "gaji_max": 2000000}'); perform pg_temp.cek('gaji maks < min ditolak', false);
    exception when check_violation then perform pg_temp.cek('gaji maks < min ditolak', true); end;
    begin perform public.save_job_details(lw, '{"kota": "Denpasar", "jenis": "FREELANCE"}'); perform pg_temp.cek('jenis kerja di luar daftar schema.org ditolak', false);
    exception when check_violation then perform pg_temp.cek('jenis kerja di luar daftar schema.org ditolak', true); end;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    r := public.lowongan_publik(v_kode);
    perform pg_temp.cek('lowongan publik membawa rincian JobPosting', r ->> 'kota' = 'Denpasar' and r ->> 'jenis' = 'PART_TIME' and (r ->> 'gaji_min')::bigint = 2500000
      and (r ->> 'terindeks')::boolean and (r ->> 'dibuat_at') is not null, r::text);
    la := (public.lamar_daftar(v_kode, 'Dewi Lestari', '0812-3456-7200', repeat('a', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    la2 := (public.lamar_daftar(v_kode, 'Rudi Hartono', '0812-3456-7201', repeat('b', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    la3 := (public.lamar_daftar(v_kode, 'Sari Wulandari', '0812-3456-7202', repeat('c', 64), 'application/pdf', 1000) ->> 'lamaran')::uuid;
    perform public.tag_application_source(la, 'Instagram');
    perform public.tag_application_source(la, 'whatsapp');
    perform public.tag_application_source(la2, 'wa-grup!');
    tok := public.lamar_lanjut(la, true);
    execute 'reset role';
    perform pg_temp.cek('sumber disimpan sekali, huruf kecil dan dibersihkan', (select source from public.lamaran where id = la) = 'instagram'
      and (select source from public.lamaran where id = la2) = 'wagrup' and (select source from public.lamaran where id = la3) is null);
    update public.lamaran set dibuat_at = now() - interval '3 hours' where id = la3;
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform public.tag_application_source(la3, 'facebook');
    execute 'reset role';
    perform pg_temp.cek('sumber tidak bisa ditandai setelah 2 jam', (select source from public.lamaran where id = la3) is null);

    -- Jadwal wawancara.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    t0 := date_trunc('hour', now()) + interval '2 days';
    r := public.schedule_interview(la, t0, 45, 'Warung, Jl. Uji 1', 'Bawa KTP', k);
    s1 := (r ->> 'id')::uuid;
    perform pg_temp.cek('wawancara terjadwal 45 menit', (select ends_at - starts_at from public.interview_slot where id = s1) = interval '45 minutes' and (r ->> 'bentrok')::int = 0, r::text);
    perform pg_temp.cek('kunci sama tidak membuat jadwal kedua', (public.schedule_interview(la, t0, 45, 'Warung', null, k) ->> 'id')::uuid = s1
      and (select count(*) from public.interview_slot) = 1);
    perform pg_temp.cek('tahap masuk menjadi ditinjau', (select tahap from public.lamaran where id = la) = 'ditinjau');
    r := public.schedule_interview(la2, t0 + interval '30 minutes', 30, 'Warung', null, gen_random_uuid());
    perform pg_temp.cek('jadwal bertumpuk dihitung, tidak ditolak', (r ->> 'bentrok')::int = 1, r::text);
    begin perform public.schedule_interview(la2, now() - interval '1 day', 30, 'Warung', null, gen_random_uuid()); perform pg_temp.cek('waktu lampau ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('waktu lampau ditolak', true); end;
    begin perform public.schedule_interview(la2, t0, 5, 'Warung', null, gen_random_uuid()); perform pg_temp.cek('durasi < 15 menit ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('durasi < 15 menit ditolak', true); end;

    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    r := public.status_lamaran(tok);
    perform pg_temp.cek('pelamar melihat jadwalnya di status (untuk .ics)', jsonb_array_length(r -> 'wawancara') = 1
      and (r -> 'wawancara' -> 0 ->> 'lokasi') = 'Warung, Jl. Uji 1' and (r -> 'wawancara' -> 0 ->> 'mulai')::timestamptz = t0 and r ->> 'zona' is not null, r::text);
    begin perform public.schedule_interview(la, t0, 30, 'x y', null, gen_random_uuid()); perform pg_temp.cek('anon tidak menjadwalkan', false);
    exception when insufficient_privilege then perform pg_temp.cek('anon tidak menjadwalkan', true); end;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.cancel_interview(s1);
    perform pg_temp.cek('batal menaikkan urutan', (select status = 'cancelled' and sequence = 1 from public.interview_slot where id = s1));
    execute 'set local role anon';
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform pg_temp.cek('jadwal batal hilang dari status pelamar', jsonb_array_length(public.status_lamaran(tok) -> 'wawancara') = 0);

    -- Laporan: la diterima 3 hari setelah lowongan dibuat.
    execute 'reset role';
    update public.lowongan set dibuat_at = now() - interval '3 days' where id = lw;
    v_hari := app.hari_ini(pa);
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    perform public.ubah_tahap_lamaran(la, 'diterima', null);
    r := public.recruitment_report(v_hari - 30, v_hari);
    perform pg_temp.cek('laporan: 3 pelamar, 1 diterima, hari isi 3', (r ->> 'pelamar')::int = 3 and (r ->> 'diterima')::int = 1
      and round((r ->> 'rata_hari_isi')::numeric) = 3, r::text);
    perform pg_temp.cek('laporan: biaya iklan per pelamar 50.000', (r -> 'lowongan' -> 0 ->> 'biaya_per_pelamar')::numeric = 50000 and (r -> 'lowongan' -> 0 ->> 'ditinjau')::int = 1, r::text);
    perform pg_temp.cek('laporan per sumber: instagram 1 diterima, wagrup 1, langsung 1',
      (select (x ->> 'diterima')::int from jsonb_array_elements(r -> 'sumber') x where x ->> 'sumber' = 'instagram') = 1
      and (select (x ->> 'pelamar')::int from jsonb_array_elements(r -> 'sumber') x where x ->> 'sumber' = 'wagrup') = 1
      and (select (x ->> 'pelamar')::int from jsonb_array_elements(r -> 'sumber') x where x ->> 'sumber' = 'langsung') = 1, r::text);

    -- Rencana kebutuhan orang.
    perform public.save_manpower_plan(tp, 2026, 3, 9000000, 'Tambah dua untuk shift malam');
    perform public.save_manpower_plan(tp, 2026, 4, 12000000, null);
    r := public.manpower_report(2026);
    perform pg_temp.cek('rencana: target 4 (diperbarui), terisi 1 dari topi, 1 lowongan buka', jsonb_array_length(r) = 1 and (r -> 0 ->> 'target')::int = 4
      and (r -> 0 ->> 'terisi')::int = 1 and (r -> 0 ->> 'lowongan_buka')::int = 1 and (r -> 0 ->> 'anggaran')::bigint = 12000000, r::text);

    -- Peran dan isolasi.
    execute 'reset role';
    select user_id into u_s from public.orang where id = o_s;
    ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ks, true);
    begin perform public.recruitment_report(v_hari - 30, v_hari); perform pg_temp.cek('staf tidak melihat laporan rekrutmen', false);
    exception when sqlstate '42501' then perform pg_temp.cek('staf tidak melihat laporan rekrutmen', true); end;
    perform pg_temp.cek('staf tidak membaca jadwal dan rencana', (select count(*) from public.interview_slot) = 0 and (select count(*) from public.manpower_plan) = 0);
    perform set_config('request.jwt.claims', kb, true);
    perform pg_temp.cek('usaha lain tidak melihat jadwal dan rencana', (select count(*) from public.interview_slot) = 0 and (select count(*) from public.manpower_plan) = 0);
    begin perform public.schedule_interview(la2, t0, 30, 'Warung', null, gen_random_uuid()); perform pg_temp.cek('usaha lain tidak menjadwalkan lamaran A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak menjadwalkan lamaran A', true); end;
    begin perform public.save_manpower_plan(tp, 2026, 1, 0, null); perform pg_temp.cek('usaha lain tidak memakai topi A', false);
    exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak memakai topi A', true); end;
    perform pg_temp.cek('laporan usaha lain kosong', (public.recruitment_report(v_hari - 30, v_hari) ->> 'pelamar')::int = 0);
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
