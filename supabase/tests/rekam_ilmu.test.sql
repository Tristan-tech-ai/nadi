-- Tes Rekam Ilmu (F3-07C): hanya orang yang berhenti merekam butir ilmunya sendiri (rekan, pemilik, butir non-ilmu, paket
-- selesai ditolak 42501), jalur berkas serah/<berhenti>, unggah belum ada = 55000, pemilik/admin menyimpan langkah tervalidasi,
-- staf tidak, usaha lain tidak menemukan butir. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ksari text; kbudi text;
  o_sari uuid; o_budi uuid; u_sari uuid; u_budi uuid; t_esp uuid; bh uuid; ilmu uuid; topi_butir uuid; r jsonb; n int;
  sha text := repeat('ab', 32);
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Ilmu A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Ilmu B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Ilmu') returning id into o_sari;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi Ilmu') returning id into o_budi;
  insert into public.topi (perusahaan_id, kode, nama) values (pa, 'espresso_ilmu', 'Barista Espresso') returning id into t_esp;
  insert into public.pakai_topi (perusahaan_id, orang_id, topi_id) values (pa, o_sari, t_esp);
  perform public.buat_akun_staf(o_sari, '123456');
  perform public.buat_akun_staf(o_budi, '654321');
  select user_id into u_sari from public.orang where id = o_sari;
  select user_id into u_budi from public.orang where id = o_budi;
  ksari := json_build_object('sub', u_sari, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  kbudi := json_build_object('sub', u_budi, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  r := public.catat_berhenti(o_sari, current_date, current_date + 30, 'mundur', gen_random_uuid());
  execute 'reset role';
  select id into bh from public.berhenti where orang_id = o_sari;
  select id into ilmu from public.serah_butir where berhenti_id = bh and jenis = 'ilmu' limit 1;
  select id into topi_butir from public.serah_butir where berhenti_id = bh and jenis = 'topi' limit 1;
  perform pg_temp.cek('paket punya butir ilmu dan topi', ilmu is not null and topi_butir is not null);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ksari, true);
  select count(*) into n from public.serah_butir;
  perform pg_temp.cek('orang itu melihat butir ilmunya saja', n >= 1 and not exists (select 1 from public.serah_butir where jenis <> 'ilmu'), n::text);
  r := public.rekam_ilmu_daftar(ilmu, sha, 'audio/webm;codecs=opus', 120000, 75.4);
  perform pg_temp.cek('jalur serah/<berhenti>', r ->> 'jalur' = pa || '/serah/' || bh || '/' || sha || '.webm', r::text);
  perform pg_temp.cek('perlu unggah', (r ->> 'perlu_unggah')::boolean);
  begin perform public.rekam_ilmu_selesai(ilmu); perform pg_temp.cek('selesai tanpa objek ditolak', false);
  exception when sqlstate '55000' then perform pg_temp.cek('selesai tanpa objek ditolak', true); end;
  begin perform public.rekam_ilmu_daftar(topi_butir, sha, 'audio/webm', 1000, 10); perform pg_temp.cek('butir non-ilmu ditolak', false);
  exception when sqlstate '42501' then perform pg_temp.cek('butir non-ilmu ditolak', true); end;
  begin perform public.rekam_ilmu_daftar(ilmu, sha, 'video/mp4', 1000, 10); perform pg_temp.cek('bukan suara ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('bukan suara ditolak', true); end;
  begin perform public.rekam_ilmu_daftar(ilmu, sha, 'audio/webm', 1000, 400); perform pg_temp.cek('lebih dari 5 menit ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('lebih dari 5 menit ditolak', true); end;
  begin perform public.simpan_ilmu(ilmu, 'teks', '["Langkah"]', 'pemilik'); perform pg_temp.cek('staf tidak menyimpan langkah', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak menyimpan langkah', true); end;

  perform set_config('request.jwt.claims', kbudi, true);
  perform pg_temp.cek('rekan tidak melihat butir', not exists (select 1 from public.serah_butir));
  begin perform public.rekam_ilmu_daftar(ilmu, sha, 'audio/webm', 1000, 10); perform pg_temp.cek('rekan tidak bisa merekam', false);
  exception when sqlstate '42501' then perform pg_temp.cek('rekan tidak bisa merekam', true); end;

  perform set_config('request.jwt.claims', ka, true);
  begin perform public.rekam_ilmu_daftar(ilmu, sha, 'audio/webm', 1000, 10); perform pg_temp.cek('pemilik tidak merekam atas nama orang itu', false);
  exception when sqlstate '42501' then perform pg_temp.cek('pemilik tidak merekam atas nama orang itu', true); end;
  perform public.simpan_ilmu(ilmu, 'Pertama nyalakan mesin. Lalu tunggu lampu hijau.', '["Nyalakan mesin espresso.", "Tunggu lampu hijau sebelum menyeduh."]', 'model');
  perform pg_temp.cek('pemilik menyimpan langkah', (select jsonb_array_length(langkah) = 2 and langkah_sumber = 'model' and transkrip like 'Pertama%' from public.serah_butir where id = ilmu));
  begin perform public.simpan_ilmu(ilmu, null, '{"bukan": "larik"}', 'model'); perform pg_temp.cek('langkah bukan larik ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('langkah bukan larik ditolak', true); end;
  begin perform public.simpan_ilmu(ilmu, null, jsonb_build_array(repeat('x', 301)), 'pemilik'); perform pg_temp.cek('langkah terlalu panjang ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('langkah terlalu panjang ditolak', true); end;
  perform pg_temp.cek('berkas tercatat milik Sari', exists (select 1 from public.berkas where sha256 = sha and perusahaan_id = pa and diunggah_oleh = u_sari));

  perform set_config('request.jwt.claims', kb, true);
  begin perform public.simpan_ilmu(ilmu, null, '["x"]', 'pemilik'); perform pg_temp.cek('usaha lain tidak menemukan butir', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha lain tidak menemukan butir', true); end;

  execute 'reset role';
  update public.berhenti set status = 'selesai' where id = bh;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ksari, true);
  begin perform public.rekam_ilmu_daftar(ilmu, sha, 'audio/webm', 1000, 10); perform pg_temp.cek('paket selesai: tidak bisa merekam lagi', false);
  exception when sqlstate '42501' then perform pg_temp.cek('paket selesai: tidak bisa merekam lagi', true); end;
  execute 'reset role';
  perform pg_temp.cek('anon tidak bisa merekam', not has_function_privilege('anon', 'public.rekam_ilmu_daftar(uuid, text, text, bigint, numeric)', 'execute'));
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'rekam_ilmu: %/% lulus, gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
