-- Tes H-01 biaya operasi per usaha per bulan: token AI dikali harga di konfigurasi harga_ai (per model, cache baca/tulis, diskon
-- batch per tugas, harga prompt panjang di atas ambang), token model tanpa harga dilaporkan terpisah dan tidak dihitung, bulan lain
-- dan usaha lain tidak ikut, storage dari storage.objects jalur {pid}/, database perkiraan dari jumlah baris x byte per baris,
-- rupiah = usd x kurs; app.biaya_platform merangkum semua usaha; authenticated dan anon tidak bisa memanggil keduanya.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; r jsonb; rb jsonb; pl jsonb; n_orang bigint;
begin
  begin
    insert into public.konfigurasi (kunci, nilai) values ('harga_ai', jsonb_build_object(
      'kurs_idr', 18000, 'diskon_batch', 0.5, 'tugas_batch', jsonb_build_array('analis_malam'), 'sumber', 'uji',
      'model', jsonb_build_object(
        'uji-ringan', jsonb_build_object('masuk', 1, 'keluar', 5, 'cache_baca', 0.1, 'cache_tulis', 1.25,
          'panjang', jsonb_build_object('ambang', 100000, 'masuk', 2, 'keluar', 10, 'cache_baca', 0.2, 'cache_tulis', 2.5)))))
    on conflict (kunci) do update set nilai = excluded.nilai;
    insert into public.konfigurasi (kunci, nilai) values ('biaya_platform', jsonb_build_object(
      'storage_usd_gb', 2, 'db_usd_gb', 4, 'byte_baris', jsonb_build_object('orang', 1073741824)))
    on conflict (kunci) do update set nilai = excluded.nilai;

    insert into auth.users (id, email) values (ua, 'biaya-a@uji.local'), (ub, 'biaya-b@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji Biaya', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Biaya B', 'toko');
    execute 'reset role';

    insert into public.pemakaian_ai (perusahaan_id, tugas, model, token_masuk, token_keluar, token_cache_baca, token_cache_tulis, dibuat_at) values
      (pa, 'baca_berkas', 'uji-ringan', 50000, 1000000, 40000, 0, now()),          -- 0,05 + 5 + 0,004 = 5,054
      (pa, 'analis_malam', 'uji-ringan', 1000000, 0, 0, 0, now()),                 -- prompt panjang: 2 x 0,5 = 1
      (pa, 'baca_berkas', 'uji-ringan', 60000, 0, 30000, 10000, now()),            -- tepat ambang 100.000: 0,06 + 0,003 + 0,0125
      (pa, 'baca_berkas', 'model-tanpa-harga', 1000, 500, 0, 0, now()),            -- tanpa harga: 1.500 token
      (pa, 'baca_berkas', 'uji-ringan', 100000, 0, 0, 0, now() - interval '2 months'),
      (pb, 'baca_berkas', 'uji-ringan', 100000, 0, 0, 0, now());                   -- usaha B: 0,1
    insert into storage.objects (bucket_id, name, metadata) values
      ('berkas', pa::text || '/lempar/uji-biaya-1.jpg', '{"size": 536870912}'),
      ('berkas', pb::text || '/lempar/uji-biaya-2.jpg', '{"size": 1024}');
    select count(*) into n_orang from public.orang where perusahaan_id = pa;

    r := app.biaya_usaha(pa, current_date);
    perform pg_temp.cek('ai usd = 5,054 + 1 + 0,0755', (r -> 'ai' ->> 'usd')::numeric = 6.1295, r::text);
    perform pg_temp.cek('panggilan bulan ini saja (4)', (r -> 'ai' ->> 'panggilan')::int = 4, r::text);
    perform pg_temp.cek('token tanpa harga dilaporkan', (r -> 'ai' ->> 'token_tanpa_harga')::bigint = 1500, r::text);
    perform pg_temp.cek('rincian per tugas', (r -> 'ai' -> 'per_tugas' ->> 'analis_malam')::numeric = 1
      and (r -> 'ai' -> 'per_tugas' ->> 'baca_berkas')::numeric = 5.1295, r::text);
    perform pg_temp.cek('storage dari jalur usaha', (r ->> 'storage_byte')::bigint >= 536870912
      and (r ->> 'storage_byte')::bigint < 536870912 + 1024 * 1024 * 100, r::text);
    perform pg_temp.cek('db perkiraan = baris orang x byte', (r ->> 'db_byte')::bigint = n_orang * 1073741824, r::text);
    perform pg_temp.cek('usd total = ai + storage + db', abs((r ->> 'usd')::numeric
      - (6.1295 + (r ->> 'storage_byte')::numeric / 1073741824 * 2 + n_orang * 4)) < 0.000001, r::text);
    perform pg_temp.cek('rupiah = usd x kurs dibulatkan', (r ->> 'idr')::numeric = round((r ->> 'usd')::numeric * 18000), r::text);

    rb := app.biaya_usaha(pb, current_date);
    perform pg_temp.cek('usaha B hanya datanya', (rb -> 'ai' ->> 'usd')::numeric = 0.1 and (rb -> 'ai' ->> 'panggilan')::int = 1, rb::text);
    r := app.biaya_usaha(pa, (current_date - interval '2 months')::date);
    perform pg_temp.cek('bulan lalu terpisah', (r -> 'ai' ->> 'usd')::numeric = 0.1 and (r -> 'ai' ->> 'panggilan')::int = 1, r::text);

    pl := app.biaya_platform(current_date);
    perform pg_temp.cek('rangkuman platform memuat semua usaha', (pl ->> 'usaha')::int >= 2
      and (pl ->> 'total_usd')::numeric >= 6.2295 and (pl ->> 'p90_usd') is not null and (pl ->> 'median_usd') is not null, pl::text);

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
    begin perform app.biaya_usaha(pa, current_date); perform pg_temp.cek('pemilik tidak bisa memanggil biaya_usaha', false);
    exception when others then perform pg_temp.cek('pemilik tidak bisa memanggil biaya_usaha', sqlstate = '42501', sqlerrm); end;
    begin perform app.biaya_platform(current_date); perform pg_temp.cek('pemilik tidak bisa memanggil biaya_platform', false);
    exception when others then perform pg_temp.cek('pemilik tidak bisa memanggil biaya_platform', sqlstate = '42501', sqlerrm); end;
    execute 'set local role anon';
    begin perform app.biaya_usaha(pa, current_date); perform pg_temp.cek('anon ditolak', false);
    exception when others then perform pg_temp.cek('anon ditolak', sqlstate = '42501', sqlerrm); end;
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
