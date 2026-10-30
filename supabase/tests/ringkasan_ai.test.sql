-- Tes ringkasan_ai. Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; ks text; r jsonb;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  r := public.ringkasan_ai(30);
  perform pg_temp.cek('usaha baru: semua nol', (r ->> 'berkas_model')::int = 0 and (r ->> 'token_hemat')::numeric = 0 and (r ->> 'token_baca')::numeric = 0);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  ks := json_build_object('sub', (select user_id from public.orang where id = o1), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'reset role';

  -- Dua invoice dibaca model (2.000 dan 3.000 token), tiga dibaca aturan; satu nota model 600 token; usaha B punya data sendiri.
  insert into public.berkas (perusahaan_id, jalur, mime, status, jenis_terdeteksi, hasil, token_ai) values
    (pa, 'x/1', 'application/pdf', 'usulan', 'invoice', '{"sumber":"model"}', 2000),
    (pa, 'x/2', 'application/pdf', 'selesai', 'invoice', '{"sumber":"model"}', 3000),
    (pa, 'x/3', 'application/pdf', 'usulan', 'invoice', '{"sumber":"aturan"}', 0),
    (pa, 'x/4', 'application/pdf', 'usulan', 'invoice', '{"sumber":"aturan"}', 0),
    (pa, 'x/5', 'application/pdf', 'usulan', 'invoice', '{"sumber":"aturan"}', 0),
    (pa, 'x/6', 'image/png', 'usulan', 'nota', '{}', 600),
    (pb, 'y/1', 'application/pdf', 'usulan', 'invoice', '{"sumber":"aturan"}', 0);
  insert into public.pemakaian_ai (perusahaan_id, tugas, model, token_masuk, token_keluar, token_cache_baca) values
    (pa, 'baca_berkas', 'm', 4000, 1600, 900), (pa, 'tulis_aturan', 'm', 1500, 500, 0), (pb, 'baca_berkas', 'm', 99999, 0, 0);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  r := public.ringkasan_ai(30);
  perform pg_temp.cek('berkas dibaca model dan aturan dihitung terpisah', (r ->> 'berkas_model')::int = 3 and (r ->> 'berkas_aturan')::int = 3, r::text);
  perform pg_temp.cek('token dihemat = rata-rata invoice model (2.500) x 3', (r ->> 'token_hemat')::numeric = 7500, r::text);
  perform pg_temp.cek('token baca dan tulis aturan dari pemakaian_ai usaha ini saja', (r ->> 'token_baca')::numeric = 5600 and (r ->> 'token_tulis_aturan')::numeric = 2000 and (r ->> 'token_cache')::numeric = 900, r::text);
  perform set_config('request.jwt.claims', ks, true);
  perform pg_temp.cek('staf tidak mendapat ringkasan', public.ringkasan_ai(30) is null);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  r := public.ringkasan_ai(30);
  perform pg_temp.cek('usaha B hanya melihat datanya sendiri', (r ->> 'berkas_aturan')::int = 1 and (r ->> 'berkas_model')::int = 0 and (r ->> 'token_baca')::numeric = 99999, r::text);
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
