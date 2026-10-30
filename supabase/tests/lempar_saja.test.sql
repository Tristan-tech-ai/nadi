-- Tes Lempar Saja (lempar_berkas, pemakaian_ai, konfigurasi). Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; ks text; r jsonb; r2 jsonb; r3 jsonb;
  sha text := repeat('ab', 32); n int;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  r := public.lempar_berkas(sha, 'nota.png', 'image/png', 1000);
  perform pg_temp.cek('pendaftaran baru berstatus unggah di folder usaha', r ->> 'status' = 'unggah' and r ->> 'jalur' = pa::text || '/lempar/' || sha || '.png');
  r2 := public.lempar_berkas(sha, 'nota-lagi.png', 'image/png', 1000);
  perform pg_temp.cek('sha sama di usaha sama: tidak didaftarkan dua kali', (r2 ->> 'ada')::boolean and r2 ->> 'id' = r ->> 'id');
  select count(*) into n from public.berkas where sha256 = sha;
  perform pg_temp.cek('hanya satu baris berkas', n = 1);
  begin
    perform public.lempar_berkas('bukan-hex', 'x.png', 'image/png', 10);
    perform pg_temp.cek('sha256 tidak sah ditolak', false, 'seharusnya ditolak');
  exception when invalid_parameter_value then perform pg_temp.cek('sha256 tidak sah ditolak', true); end;
  begin
    perform public.lempar_berkas(repeat('cd', 32), 'besar.pdf', 'application/pdf', 20000000);
    perform pg_temp.cek('berkas di atas 10 MB ditolak', false, 'seharusnya ditolak');
  exception when invalid_parameter_value then perform pg_temp.cek('berkas di atas 10 MB ditolak', true); end;
  insert into public.orang (perusahaan_id, nama) values (pa, 'Budi') returning id into o1;
  r3 := public.buat_akun_staf(o1, '123456');
  -- Klaim staf disusun selagi masih di usaha A (RLS orang menyembunyikan baris A dari B).
  ks := json_build_object('sub', (select user_id from public.orang where id = o1), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  -- Usaha B: sha sama didaftarkan sebagai berkas baru miliknya sendiri (anti-duplikat per usaha, tidak bocor lintas usaha).
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  r2 := public.lempar_berkas(sha, 'nota.png', 'image/png', 1000);
  perform pg_temp.cek('usaha B mendaftarkan sha yang sama sebagai berkas sendiri', not (r2 ->> 'ada')::boolean and r2 ->> 'id' <> r ->> 'id');
  select count(*) into n from public.berkas;
  perform pg_temp.cek('usaha B hanya melihat berkas miliknya', n = 1);

  -- Staf A mendaftarkan berkas yang sudah dilempar pemilik: hanya tahu "sudah ada", tanpa id atau jalur.
  perform set_config('request.jwt.claims', ks, true);
  r2 := public.lempar_berkas(sha, 'nota.png', 'image/png', 1000);
  perform pg_temp.cek('staf diberi tahu sudah ada tanpa detail berkas orang lain', (r2 ->> 'ada')::boolean and r2 -> 'id' is null and r2 -> 'jalur' is null);
  r2 := public.lempar_berkas(repeat('ef', 32), 'surat-sakit.jpg', 'image/jpeg', 500);
  perform pg_temp.cek('staf bisa melempar berkas baru', not (r2 ->> 'ada')::boolean and r2 ->> 'jalur' like '%.jpg');
  select count(*) into n from public.pemakaian_ai;
  perform pg_temp.cek('staf tidak melihat pemakaian AI', n = 0);
  perform pg_temp.cek('konfigurasi terbaca semua anggota', exists (select 1 from public.konfigurasi where kunci = 'model_ai'));
  begin
    update public.konfigurasi set nilai = '{}' where kunci = 'model_ai';
    perform pg_temp.cek('konfigurasi tidak bisa diubah klien', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('konfigurasi tidak bisa diubah klien', true); end;
  execute 'reset role';

  -- Tanpa usaha aktif: ditolak.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  begin
    perform public.lempar_berkas(repeat('12', 32), 'x.png', 'image/png', 10);
    perform pg_temp.cek('tanpa usaha aktif ditolak', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('tanpa usaha aktif ditolak', true); end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform public.lempar_berkas(repeat('12', 32), 'x.png', 'image/png', 10);
    perform pg_temp.cek('anon tidak bisa memanggil lempar_berkas', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa memanggil lempar_berkas', true); end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
