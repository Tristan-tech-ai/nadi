-- Tes T-01A (supabase/migrations/20261105102000_tanya_aturan.sql): aturan tanya mulai bayangan, database menolak aktif sebelum
-- 2 kali cocok, aturan hanya struktur (kata huruf kecil 1-3 kata, tanpa angka/data; niat dari daftar tetap), klien tidak bisa
-- menulis aturan, usaha lain tidak melihat aturan usaha ini, staf ditolak konteks belajar. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o uuid; v uuid; r jsonb; n int;
begin
  insert into auth.users (id, email) values (ua, 'ta.a@uji.local'), (ub, 'ta.b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Uji Tanya A', 'toko');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji Tanya B', 'toko');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o;
  perform public.buat_akun_staf(o, '530102');
  execute 'reset role';
  select json_build_object('sub', user_id, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text into ks from public.orang where id = o;

  -- Penulisan oleh Edge Function (peran server) diwakili postgres di sini.
  insert into public.tanya_aturan (perusahaan_id, kata, niat, asal) values (pa, 'cuan', 'laba', '{"model":"uji"}') returning id into v;
  perform pg_temp.cek('aturan baru mulai bayangan', (select status = 'bayangan' and bayangan_cocok = 0 from public.tanya_aturan where id = v));
  begin
    update public.tanya_aturan set status = 'aktif' where id = v;
    perform pg_temp.cek('aktif tanpa 2 kali cocok ditolak', false);
  exception when check_violation then perform pg_temp.cek('aktif tanpa 2 kali cocok ditolak', true); end;
  update public.tanya_aturan set bayangan_cocok = 2, status = 'aktif' where id = v;
  perform pg_temp.cek('aktif setelah 2 kali cocok', (select status = 'aktif' from public.tanya_aturan where id = v));
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (null, 'pelanggan 0812', 'piutang');
    perform pg_temp.cek('aturan bersama berisi angka ditolak', false);
  exception when check_violation then perform pg_temp.cek('aturan bersama berisi angka ditolak', true); end;
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (null, 'satu dua tiga empat', 'laba');
    perform pg_temp.cek('lebih dari 3 kata ditolak', false);
  exception when check_violation then perform pg_temp.cek('lebih dari 3 kata ditolak', true); end;
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (pa, 'Budi Santoso', 'gaji');
    perform pg_temp.cek('huruf besar (nama orang) ditolak', false);
  exception when check_violation then perform pg_temp.cek('huruf besar (nama orang) ditolak', true); end;
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (pa, 'saldo bebas', 'pendapat');
    perform pg_temp.cek('niat di luar daftar tetap ditolak', false);
  exception when check_violation then perform pg_temp.cek('niat di luar daftar tetap ditolak', true); end;
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (pa, 'cuan', 'pendapatan');
    perform pg_temp.cek('satu aturan per kata per usaha', false);
  exception when unique_violation then perform pg_temp.cek('satu aturan per kata per usaha', true); end;
  insert into public.tanya_aturan (perusahaan_id, kata, niat) values (null, 'omzetnya', 'pendapatan');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  select count(*) into n from public.tanya_aturan where kata in ('cuan', 'omzetnya');
  perform pg_temp.cek('pemilik A melihat aturannya dan aturan bersama', n = 2, n::text);
  r := public.learn_question_context();
  perform pg_temp.cek('konteks belajar memberi usaha sesi', (r ->> 'perusahaan_id')::uuid = pa, r::text);
  begin
    insert into public.tanya_aturan (perusahaan_id, kata, niat) values (pa, 'untungnya', 'laba');
    perform pg_temp.cek('klien tidak bisa menulis aturan', false);
  exception when insufficient_privilege then perform pg_temp.cek('klien tidak bisa menulis aturan', true); end;
  begin
    update public.tanya_aturan set status = 'aktif', bayangan_cocok = 9 where perusahaan_id = pa;
    perform pg_temp.cek('klien tidak bisa mengaktifkan aturan', false);
  exception when insufficient_privilege then perform pg_temp.cek('klien tidak bisa mengaktifkan aturan', true); end;
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.tanya_aturan where kata = 'cuan';
  perform pg_temp.cek('usaha B tidak melihat aturan usaha A', n = 0, n::text);
  perform set_config('request.jwt.claims', ks, true);
  select count(*) into n from public.tanya_aturan;
  perform pg_temp.cek('staf tidak membaca aturan', n = 0, n::text);
  begin
    r := public.learn_question_context();
    perform pg_temp.cek('staf ditolak konteks belajar', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf ditolak konteks belajar', true); end;
  execute 'reset role';
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
