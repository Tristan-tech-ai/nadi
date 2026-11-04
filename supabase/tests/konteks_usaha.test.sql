-- Tes W-03 konteks usaha (supabase/migrations/20261104056000_konteks_usaha.sql): bawaan Indonesia/IDR, negara lain mengisi
-- mata uang dan zona dari daftar, zona Indonesia bisa WITA/WIT, zona asing ditolak, hanya pemilik, usaha lain tidak berubah.
-- Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kd text; r jsonb;
begin
  begin
    perform pg_temp.cek('kolom dan tabel negara ada', to_regclass('public.negara') is not null
      and (select count(*) = 5 from information_schema.columns where table_schema = 'public' and table_name = 'perusahaan' and column_name in ('skala', 'cabang', 'kota', 'negara', 'mata_uang')));
    insert into auth.users (id, email) values (ua, 'ka@uji.local'), (ub, 'kb@uji.local'), (ud, 'kd@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Kedai Uji Konteks', 'fnb');
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    pb := public.buat_perusahaan('Toko Uji Konteks B', 'toko');
    execute 'reset role';
    insert into public.anggota (perusahaan_id, user_id, peran) values (pa, ud, 'admin');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
    kd := json_build_object('sub', ud, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
    perform pg_temp.cek('usaha baru bawaan Indonesia, IDR, Asia/Jakarta', (select negara = 'ID' and mata_uang = 'IDR' and zona_waktu = 'Asia/Jakarta' from public.perusahaan where id = pa));

    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', ka, true);
    r := public.atur_konteks_usaha('6-15', 2, 'Denpasar', 'ID', 'Asia/Makassar');
    perform pg_temp.cek('Indonesia dengan WITA, 2 cabang, 6-15 orang', (select skala = '6-15' and cabang = 2 and kota = 'Denpasar' and zona_waktu = 'Asia/Makassar'
      from public.perusahaan where id = pa) and (r ->> 'aturan_indonesia')::boolean, r::text);
    r := public.atur_konteks_usaha('2-5', 1, 'Kuala Lumpur', 'my', null);
    perform pg_temp.cek('Malaysia: mata uang MYR dan zona Asia/Kuala_Lumpur terisi sendiri', (select negara = 'MY' and mata_uang = 'MYR' and zona_waktu = 'Asia/Kuala_Lumpur'
      from public.perusahaan where id = pa) and not (r ->> 'aturan_indonesia')::boolean, r::text);
    begin
      perform public.atur_konteks_usaha('2-5', 1, null, 'MY', 'Asia/Makassar');
      perform pg_temp.cek('zona Indonesia untuk usaha Malaysia ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('zona Indonesia untuk usaha Malaysia ditolak', true);
    end;
    begin
      perform public.atur_konteks_usaha('2-5', 1, null, 'XX', null);
      perform pg_temp.cek('negara tak dikenal ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('negara tak dikenal ditolak', true);
    end;
    begin
      perform public.atur_konteks_usaha('banyak', 1, null, 'ID', null);
      perform pg_temp.cek('skala di luar daftar ditolak', false);
    exception when sqlstate '22023' then perform pg_temp.cek('skala di luar daftar ditolak', true);
    end;
    perform set_config('request.jwt.claims', kd, true);
    begin
      perform public.atur_konteks_usaha('1', 1, null, 'ID', null);
      perform pg_temp.cek('admin tidak boleh mengubah konteks usaha', false);
    exception when insufficient_privilege then perform pg_temp.cek('admin tidak boleh mengubah konteks usaha', true);
    end;
    perform set_config('request.jwt.claims', kb, true);
    perform public.atur_konteks_usaha('1', 1, 'Bandung', 'ID', null);
    execute 'reset role';
    perform pg_temp.cek('usaha A tetap Malaysia setelah usaha B mengatur dirinya', (select negara = 'MY' and kota = 'Kuala Lumpur' from public.perusahaan where id = pa)
      and (select negara = 'ID' and kota = 'Bandung' and skala = '1' from public.perusahaan where id = pb));
    execute 'set local role anon';
    perform pg_temp.cek('daftar negara terbaca tanpa akun', (select count(*) >= 10 from public.negara));
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
