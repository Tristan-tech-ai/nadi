-- Tes L-03 (supabase/migrations/20261106120000_usaha_tamu.sql): sesi anonim melihat usaha contoh sebagai pemilik, tidak bisa
-- menulis lewat Data API (pre-request baca saja) maupun Storage, tidak memicu AI, tidak melihat berkas yang bisa diproses ulang;
-- akun biasa, akun anonim yang sudah ditautkan email, dan anon tidak berubah. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare tam uuid := gen_random_uuid(); biasa uuid := gen_random_uuid(); contoh uuid := app.usaha_tamu(); n int; ro text;
begin
  perform pg_temp.cek('usaha contoh terpasang', contoh is not null and exists (select 1 from public.perusahaan where id = contoh));
  insert into auth.users (id, email, is_anonymous) values (tam, null, true), (biasa, 'tamu.biasa@uji.local', false);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', tam, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform pg_temp.cek('sesi coba: usaha = usaha contoh', app.pid() = contoh);
  perform pg_temp.cek('sesi coba: peran pemilik', app.peran_aktif() = 'pemilik' and app.pengelola() and app.anggota_aktif(array['pemilik', 'admin']));
  select count(*) into n from public.orang;
  perform pg_temp.cek('sesi coba melihat orang usaha contoh saja', n > 0 and not exists (select 1 from public.orang where perusahaan_id <> contoh), n::text);
  perform pg_temp.cek('berkas yang bisa diproses ulang tidak terlihat', not exists (select 1 from public.berkas where status in ('unggah', 'antre', 'proses', 'gagal')));
  begin perform public.learn_question_context(); perform pg_temp.cek('tanya AI ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('tanya AI ditolak', true); end;
  begin perform public.learn_migration_context(); perform pg_temp.cek('pindah AI ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('pindah AI ditolak', true); end;
  begin perform public.konteks_ilmu(gen_random_uuid()); perform pg_temp.cek('langkah ilmu AI ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('langkah ilmu AI ditolak', true); end;
  begin perform public.konteks_estimasi(gen_random_uuid()); perform pg_temp.cek('estimasi AI ditolak', false);
  exception when insufficient_privilege then perform pg_temp.cek('estimasi AI ditolak', true); end;
  -- Pre-request: transaksi menjadi baca saja; tulis langsung maupun lewat RPC security definer ditolak.
  begin
    perform public.cek_permintaan();
    ro := current_setting('transaction_read_only');
    insert into public.orang (perusahaan_id, nama) values (contoh, 'Penyusup Coba');
    perform pg_temp.cek('sesi coba tidak bisa menambah orang', false, ro);
  exception when read_only_sql_transaction then perform pg_temp.cek('sesi coba tidak bisa menambah orang', true); end;
  begin
    perform public.cek_permintaan();
    perform public.buat_perusahaan('Usaha Coba Penyusup', 'toko');
    perform pg_temp.cek('sesi coba tidak bisa membuat usaha lewat RPC', false);
  exception when read_only_sql_transaction then perform pg_temp.cek('sesi coba tidak bisa membuat usaha lewat RPC', true); end;
  begin
    insert into storage.objects (bucket_id, name) values ('berkas', contoh::text || '/coba/penyusup.txt');
    perform pg_temp.cek('sesi coba tidak bisa mengunggah ke Storage', false);
  exception when insufficient_privilege then perform pg_temp.cek('sesi coba tidak bisa mengunggah ke Storage', true); end;

  -- Akun anonim yang sudah menautkan email (is_anonymous false) tidak membawa usaha contoh.
  perform set_config('request.jwt.claims', json_build_object('sub', tam, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform pg_temp.cek('setelah ditautkan: tanpa usaha', app.pid() is null and app.peran_aktif() is null and not app.pengelola());
  -- Akun biasa: pre-request tidak mengubah apa pun.
  perform set_config('request.jwt.claims', json_build_object('sub', biasa, 'role', 'authenticated')::text, true);
  begin
    perform public.cek_permintaan();
    perform pg_temp.cek('akun biasa tetap baca tulis', current_setting('transaction_read_only') = 'off');
    perform pg_temp.cek('akun biasa tanpa usaha contoh', app.pid() is null and (select count(*) from public.orang) = 0);
    perform public.buat_perusahaan('Usaha Uji Tamu Biasa', 'toko');
    perform pg_temp.cek('akun biasa masih bisa membuat usaha', true);
  exception when others then perform pg_temp.cek('akun biasa masih bisa membuat usaha', false, sqlerrm); end;
  execute 'reset role';
  -- Anon (tanpa sesi): pre-request jalan dan id usaha contoh terbaca.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.cek_permintaan();
    perform pg_temp.cek('anon: pre-request jalan, id usaha contoh terbaca', public.usaha_tamu() = contoh and current_setting('transaction_read_only') = 'off');
  exception when others then perform pg_temp.cek('anon: pre-request jalan, id usaha contoh terbaca', false, sqlerrm); end;
  execute 'reset role';
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
