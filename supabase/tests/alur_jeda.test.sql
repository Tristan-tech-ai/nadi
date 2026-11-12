-- Tes M-20B (supabase/migrations/20261106110000_alur_jeda.sql): alur berjeda menunda aksi sampai jatuh tempo, pg_cron
-- (app.flow_jalankan_tertunda) menjalankan yang jatuh tempo bila alur masih aktif, alur dimatikan membatalkan yang menunggu,
-- jeda 0 tetap langsung, set_flow_delay tervalidasi dan khusus pengelola, isolasi usaha. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_budi uuid;
  fm uuid; fj uuid; f0 uuid; r jsonb; n int; t public.flow_tertunda;
begin
  insert into auth.users (id, email) values (ua, 'jd.a@uji.local'), (ub, 'jd.b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Uji Jeda', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Lain Uji Jeda', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o_budi;
  perform public.buat_akun_staf(o_budi, '540002');
  execute 'reset role';
  select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o_budi;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', ka, true);
  fm := public.save_form('{"nama": "Permintaan pengingat", "bidang": [{"kunci": "hal", "label": "Hal", "jenis": "teks", "wajib": true}]}');
  r := public.save_flow(jsonb_build_object('nama', 'Pengingat sehari', 'pemicu', 'formulir.kirim', 'formulir', fm,
    'aksi', '[{"jenis": "kartu", "judul": "Ingat: {hal}"}]'::jsonb));
  fj := (r ->> 'id')::uuid;
  r := public.save_flow(jsonb_build_object('nama', 'Langsung', 'pemicu', 'formulir.kirim', 'formulir', fm,
    'aksi', '[{"jenis": "kartu", "judul": "Langsung: {hal}"}]'::jsonb));
  f0 := (r ->> 'id')::uuid;

  -- Validasi set_flow_delay.
  begin perform public.set_flow_delay(fj, -1); perform pg_temp.cek('jeda negatif ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('jeda negatif ditolak', true); end;
  begin perform public.set_flow_delay(fj, 169); perform pg_temp.cek('jeda di atas 168 jam ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('jeda di atas 168 jam ditolak', true); end;
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.set_flow_delay(fj, 2); perform pg_temp.cek('staf tidak bisa mengatur jeda', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak bisa mengatur jeda', true); end;
  perform set_config('request.jwt.claims', kb, true);
  begin perform public.set_flow_delay(fj, 2); perform pg_temp.cek('usaha lain tidak bisa mengatur jeda', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak bisa mengatur jeda', true); end;
  perform set_config('request.jwt.claims', ka, true);
  perform public.set_flow_delay(fj, 24);
  perform pg_temp.cek('jeda 24 jam tersimpan sebagai 1440 menit', (select jeda_menit from public.flow where id = fj) = 1440);

  -- Kejadian: alur berjeda menunggu, alur jeda 0 langsung.
  perform set_config('request.jwt.claims', ks, true);
  perform public.submit_form(fm, '{"hal": "Bayar listrik"}');
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('jeda 0: kartu langsung dibuat', exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Langsung: Bayar listrik'));
  perform pg_temp.cek('berjeda: belum ada kartu', not exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar listrik'));
  select * into t from public.flow_tertunda where flow_id = fj;
  perform pg_temp.cek('berjeda: tercatat menunggu dengan jatuh tempo sekitar 24 jam', t.status = 'menunggu'
    and t.jatuh_tempo between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute', t.jatuh_tempo::text);
  perform pg_temp.cek('jalan alur berjeda berstatus tertunda', (select status from public.flow_run where id = t.run_id) = 'tertunda');
  perform pg_temp.cek('jeda 0 tidak masuk antrean', not exists (select 1 from public.flow_tertunda where flow_id = f0));
  perform pg_temp.cek('pemilik membaca antrean usahanya', (select count(*) from public.flow_tertunda) = 1);
  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf tidak membaca antrean', (select count(*) from public.flow_tertunda) = 0);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak membaca antrean', (select count(*) from public.flow_tertunda) = 0);
  execute 'reset role';

  -- pg_cron: belum jatuh tempo tidak dijalankan.
  n := app.flow_jalankan_tertunda(200);
  perform pg_temp.cek('belum jatuh tempo: tidak ada yang dijalankan', not exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar listrik')
    and (select status from public.flow_tertunda where id = t.id) = 'menunggu');
  -- Waktu dimajukan: jatuh tempo lewat, aksi dijalankan dengan data kejadian aslinya.
  update public.flow_tertunda set jatuh_tempo = now() - interval '1 minute' where id = t.id;
  n := app.flow_jalankan_tertunda(200);
  perform pg_temp.cek('jatuh tempo: kartu dibuat dengan data kejadian', exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar listrik'), n::text);
  perform pg_temp.cek('jatuh tempo: antrean jalan dan run jalan', (select status from public.flow_tertunda where id = t.id) = 'jalan'
    and (select status from public.flow_run where id = t.run_id) = 'jalan');
  n := app.flow_jalankan_tertunda(200);
  perform pg_temp.cek('tidak dijalankan dua kali', (select count(*) from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar listrik') = 1);

  -- Alur dimatikan sebelum jatuh tempo: yang menunggu dibatalkan dan tidak pernah dijalankan.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  perform public.submit_form(fm, '{"hal": "Bayar air"}');
  perform set_config('request.jwt.claims', ka, true);
  select * into t from public.flow_tertunda where flow_id = fj and status = 'menunggu';
  perform public.set_flow_active(fj, false);
  execute 'reset role';
  perform pg_temp.cek('dimatikan: antrean batal', (select status from public.flow_tertunda where id = t.id) = 'batal');
  perform pg_temp.cek('dimatikan: run batal dengan catatan', (select status = 'batal' and catatan like 'Alur dimatikan%' from public.flow_run where id = t.run_id));
  update public.flow_tertunda set jatuh_tempo = now() - interval '1 minute' where id = t.id;
  n := app.flow_jalankan_tertunda(200);
  perform pg_temp.cek('dimatikan: kartu tidak pernah dibuat', not exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar air'));

  -- Dimatikan langsung di tabel (tanpa set_flow_active) tetap dibatalkan saat cron.
  update public.flow set aktif = true where id = fj;
  insert into public.flow_tertunda (perusahaan_id, flow_id, run_id, kejadian_id, data, jatuh_tempo)
    select perusahaan_id, flow_id, run_id, kejadian_id, data, now() - interval '1 minute' from public.flow_tertunda where id = t.id returning * into t;
  update public.flow set aktif = false where id = fj;
  n := app.flow_jalankan_tertunda(200);
  perform pg_temp.cek('cron membatalkan antrean alur yang mati', (select status from public.flow_tertunda where id = t.id) = 'batal'
    and not exists (select 1 from public.usulan where perusahaan_id = pa and judul = 'Ingat: Bayar air'));

  -- Fungsi cron tidak bisa dipanggil klien.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin perform app.flow_jalankan_tertunda(200); perform pg_temp.cek('klien tidak bisa menjalankan antrean', false);
  exception when insufficient_privilege then perform pg_temp.cek('klien tidak bisa menjalankan antrean', true); end;
  execute 'reset role';
  perform pg_temp.cek('jadwal cron terpasang tiap menit', exists (select 1 from cron.job where jobname = 'nadi-alur-tertunda' and schedule = '* * * * *'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
