-- Tes usaha_demo: demo terbaca anon lewat demo_lihat saja, tidak terlihat lewat RLS, penyegaran malam hanya menggeser waktu.
-- Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare r jsonb; ua uuid := gen_random_uuid(); pa uuid; n int; v_pid uuid; t0 timestamptz; t1 timestamptz; k0 int; k1 int;
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.demo_lihat('fnb');
  perform pg_temp.cek('anon membaca demo warung', r -> 'usaha' ->> 'nama' = 'Warung Makan Bu Ratna (contoh)' and jsonb_array_length(r -> 'usulan') = 4 and jsonb_array_length(r -> 'orang') = 5, left(r::text, 300));
  perform pg_temp.cek('ringkasan demo warung terisi', (r ->> 'belanja_7_hari')::numeric > 0 and (r ->> 'absen_kemarin')::int = 5, left(r::text, 300));
  perform pg_temp.cek('usulan bertenggat di urutan pertama', r -> 'usulan' -> 0 ->> 'judul' = 'Catat izin sakit Komang Ayu 2 hari', r -> 'usulan' -> 0 ->> 'judul');
  r := public.demo_lihat('toko');
  perform pg_temp.cek('anon membaca demo toko', jsonb_array_length(r -> 'usulan') = 3 and jsonb_array_length(r -> 'orang') = 4);
  perform pg_temp.cek('kunci lain tidak membuka apa pun', public.demo_lihat('x') is null and public.demo_lihat(null) is null);
  begin
    select count(*) into n from public.perusahaan;
    perform pg_temp.cek('anon tidak bisa membaca tabel perusahaan', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca tabel perusahaan', true);
  end;
  begin
    perform app.segarkan_demo();
    perform pg_temp.cek('anon tidak bisa memicu penyegaran', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa memicu penyegaran', true);
  end;
  execute 'reset role';

  -- Pengguna biasa tidak melihat usaha demo lewat RLS.
  insert into auth.users (id, email) values (ua, 'a@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  select count(*) into n from public.perusahaan where pengaturan ? 'demo';
  perform pg_temp.cek('usaha demo tidak terlihat lewat RLS', n = 0, n::text);
  select count(*) into n from public.usulan where sumber = 'mcp' and judul like 'Catat stok minyak%';
  perform pg_temp.cek('usulan demo tidak terlihat lewat RLS', n = 0, n::text);
  execute 'reset role';

  -- Penyegaran: jangkar dimundurkan 2 hari, setelah segarkan_demo usulan dan kejadian maju 2 hari, jumlahnya tetap.
  select id into v_pid from public.perusahaan where pengaturan ->> 'demo' = 'fnb';
  update public.perusahaan set pengaturan = jsonb_set(pengaturan, '{demo_jangkar}', to_jsonb(now() - interval '2 days')) where id = v_pid;
  select max(dibuat_at) into t0 from public.usulan where perusahaan_id = v_pid;
  select count(*) into k0 from public.kejadian where perusahaan_id = v_pid;
  perform app.segarkan_demo();
  select max(dibuat_at) into t1 from public.usulan where perusahaan_id = v_pid;
  select count(*) into k1 from public.kejadian where perusahaan_id = v_pid;
  perform pg_temp.cek('penyegaran menggeser waktu 2 hari', abs(extract(epoch from (t1 - t0)) - 172800) < 5, (t1 - t0)::text);
  perform pg_temp.cek('penyegaran tidak menambah atau menghapus kejadian', k0 = k1 and k0 > 0, k0 || ' ' || k1);  -- jumlah awal 34 bertambah oleh migrasi demo berikutnya (132 di produksi 11 Nov 2026); yang diuji adalah tetapnya
  perform pg_temp.cek('jadwal penyegaran terdaftar', exists (select 1 from cron.job where jobname = 'nadi-demo-segar'));
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
