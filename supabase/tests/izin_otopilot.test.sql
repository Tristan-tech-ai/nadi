-- Tes izin_otopilot: otopilot menyetujui pengajuan sesuai kebijakan dengan alasan tertulis; melebihi batas hari, tanpa bukti wajib,
-- kuota bersamaan penuh, saldo cuti kurang, dan jenis tanpa kebijakan masuk Feed dengan alasan; putusan manusia mengubah status;
-- staf hanya melihat pengajuannya sendiri; isolasi usaha. Transaksi dibatalkan lewat RAISE EXCEPTION; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; kd text;
  o1 uuid; o2 uuid; us uuid; ud uuid; bk uuid; r jsonb; x text; n int; usl uuid;
  h date := (now() at time zone 'Asia/Makassar')::date;
  sakit_ok uuid; sakit_lama uuid; tanpa_bukti uuid;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  perform public.atur_kebijakan_izin('sakit', true, 2, true, 1, null);
  perform public.atur_kebijakan_izin('cuti', true, 5, false, null, 3);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o2;
  perform public.buat_akun_staf(o1, '123456');
  perform public.buat_akun_staf(o2, '654321');
  select user_id into us from public.orang where id = o1;
  select user_id into ud from public.orang where id = o2;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  begin
    perform public.ajukan_izin('sakit', h, h);
    perform pg_temp.cek('pemilik tanpa data orang tidak bisa mengajukan', false);
  exception when insufficient_privilege then perform pg_temp.cek('pemilik tanpa data orang tidak bisa mengajukan', true);
  end;

  -- Sari: sakit 1 hari dengan surat -> otopilot setuju.
  perform set_config('request.jwt.claims', ks, true);
  bk := (public.lempar_berkas(repeat('a', 64), 'surat-dokter.jpg', 'image/jpeg', 1000) ->> 'id')::uuid;
  r := public.ajukan_izin('sakit', h + 1, h + 1, 'Demam', bk);
  sakit_ok := (r ->> 'id')::uuid;
  perform pg_temp.cek('sakit 1 hari dengan bukti disetujui otopilot', r ->> 'status' = 'disetujui' and (r ->> 'oleh_otopilot')::boolean, r::text);
  perform pg_temp.cek('alasan otopilot tertulis', r ->> 'alasan_putusan' = 'Disetujui otomatis: sakit 1 hari dengan bukti, sesuai kebijakan sakit.', r ->> 'alasan_putusan');
  begin
    perform public.ajukan_izin('cuti', h + 1, h + 2);
    perform pg_temp.cek('pengajuan bertumpuk ditolak', false);
  exception when unique_violation then perform pg_temp.cek('pengajuan bertumpuk ditolak', sqlerrm like 'Kamu sudah punya pengajuan%', sqlerrm);
  end;
  -- Sari: sakit 3 hari -> Feed.
  r := public.ajukan_izin('sakit', h + 20, h + 22, null, bk);
  sakit_lama := (r ->> 'id')::uuid;
  perform pg_temp.cek('sakit 3 hari (batas 2) menunggu dengan alasan', r ->> 'status' = 'menunggu' and r ->> 'alasan_putusan' like '%3 hari, lebih dari batas otomatis 2 hari%', r ->> 'alasan_putusan');
  -- Sari: izin tanpa kebijakan -> Feed.
  r := public.ajukan_izin('izin', h + 30, h + 30, 'Urusan keluarga');
  perform pg_temp.cek('jenis tanpa kebijakan masuk Feed', r ->> 'status' = 'menunggu' and r ->> 'alasan_putusan' like '%belum ada kebijakan izin%', r ->> 'alasan_putusan');
  begin
    perform public.atur_kebijakan_izin('izin', true, 3, false, null, null);
    perform pg_temp.cek('staf tidak bisa mengatur kebijakan', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mengatur kebijakan', true);
  end;
  begin
    insert into public.pengajuan_izin (perusahaan_id, orang_id, jenis, mulai, selesai, hari, status, oleh_otopilot, alasan_putusan, diajukan_oleh)
    values (pa, o1, 'cuti', h + 40, h + 49, 10, 'disetujui', true, 'palsu', us);
    perform pg_temp.cek('staf tidak bisa menulis pengajuan langsung', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa menulis pengajuan langsung', true);
  end;
  begin
    perform public.ajukan_izin('cuti', h + 5, h + 4);
    perform pg_temp.cek('tanggal terbalik ditolak', false);
  exception when others then perform pg_temp.cek('tanggal terbalik ditolak', sqlerrm like 'Tanggal selesai%', sqlerrm);
  end;

  -- Budi: tanpa bukti -> Feed; hari yang sama dengan Sari (kuota 1) -> Feed; cuti sesuai saldo -> setuju; lalu saldo kurang -> Feed.
  perform set_config('request.jwt.claims', kd, true);
  r := public.ajukan_izin('sakit', h + 3, h + 3);
  tanpa_bukti := (r ->> 'id')::uuid;
  perform pg_temp.cek('sakit tanpa bukti wajib masuk Feed', r ->> 'status' = 'menunggu' and r ->> 'alasan_putusan' like '%belum ada bukti%', r ->> 'alasan_putusan');
  bk := (public.lempar_berkas(repeat('b', 64), 'surat-budi.jpg', 'image/jpeg', 1000) ->> 'id')::uuid;
  r := public.ajukan_izin('sakit', h + 1, h + 1, null, bk);
  perform pg_temp.cek('kuota bersamaan penuh masuk Feed dengan tanggal', r ->> 'status' = 'menunggu' and r ->> 'alasan_putusan' like '%1 orang lain sudah izin pada%(batas 1)%', r ->> 'alasan_putusan');
  r := public.ajukan_izin('cuti', h + 10, h + 11, 'Pulang kampung');
  perform pg_temp.cek('cuti 2 hari dalam saldo 3 disetujui otopilot', r ->> 'status' = 'disetujui', r::text);
  r := public.izin_ringkas();
  perform pg_temp.cek('saldo cuti: jatah 3, terpakai 2, sisa 1', r -> 'cuti' = '{"jatah": 3, "terpakai": 2, "sisa": 1}'::jsonb, r::text);
  r := public.ajukan_izin('cuti', h + 14, h + 15);
  perform pg_temp.cek('cuti melebihi saldo masuk Feed', r ->> 'status' = 'menunggu' and r ->> 'alasan_putusan' like '%saldo cuti tinggal 1 hari%', r ->> 'alasan_putusan');
  select count(*) into n from public.pengajuan_izin;
  perform pg_temp.cek('staf hanya melihat pengajuannya sendiri', n = 4 and not exists (select 1 from public.pengajuan_izin where orang_id = o1), n::text);
  select count(*) into n from public.usulan;
  perform pg_temp.cek('staf tidak melihat usulan Feed', n = 0, n::text);

  -- Pemilik: Feed berisi usulan izin dengan alasan; setujui yang 3 hari, tolak yang tanpa bukti.
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.usulan where aksi = 'izin.setujui' and status = 'menunggu';
  perform pg_temp.cek('lima pengajuan di luar kebijakan menjadi usulan Feed', n = 5, n::text);
  select judul into x from public.usulan where (payload ->> 'pengajuan_id')::uuid = sakit_lama;
  perform pg_temp.cek('judul usulan menyebut nama, hari, dan tanggal', x ~ '^Setujui sakit Sari 3 hari \(\d+ \w+ sampai \d+ \w+\)$', x);
  select id into usl from public.usulan where (payload ->> 'pengajuan_id')::uuid = sakit_lama;
  r := public.putuskan_usulan(usl, true);
  perform pg_temp.cek('menyetujui usulan izin mengubah pengajuan', (select status = 'disetujui' and not oleh_otopilot and alasan_putusan = 'Disetujui pemilik.' from public.pengajuan_izin where id = sakit_lama), r::text);
  select id into usl from public.usulan where (payload ->> 'pengajuan_id')::uuid = tanpa_bukti;
  perform public.putuskan_usulan(usl, false);
  perform pg_temp.cek('menolak usulan izin menandai pengajuan ditolak dengan jalan banding', (select status = 'ditolak' and alasan_putusan like '%ajukan ulang%' from public.pengajuan_izin where id = tanpa_bukti));
  select count(*) into n from public.pengajuan_izin;
  perform pg_temp.cek('pemilik melihat semua pengajuan usahanya', n = 7, n::text);
  execute 'reset role';
  select count(*) into n from public.kejadian where perusahaan_id = pa and jenis like 'izin.%';
  perform pg_temp.cek('kejadian izin tercatat untuk tiga yang disetujui', n = 3, n::text);
  perform pg_temp.cek('kejadian sakit otopilot di tanggal mulai WITA', exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'izin.sakit'
    and orang_id = o1 and (terjadi_at at time zone 'Asia/Makassar')::date = h + 1 and (data ->> 'otopilot')::boolean));

  -- Usaha lain.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.pengajuan_izin;
  perform pg_temp.cek('usaha lain tidak melihat pengajuan', n = 0, n::text);
  select count(*) into n from public.kebijakan_izin;
  perform pg_temp.cek('usaha lain tidak melihat kebijakan', n = 0, n::text);
  select id into usl from public.usulan where perusahaan_id = pa and aksi = 'izin.setujui' and status = 'menunggu' limit 1;
  perform pg_temp.cek('usaha lain tidak melihat usulan izin', usl is null);
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
