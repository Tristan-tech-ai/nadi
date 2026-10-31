-- Tes Q-17: setiap usulan selalu bisa dilihat pemilik. public.usulan menolak untuk_peran tanpa 'pemilik' (CHECK, 23514),
-- baik lewat insert maupun update oleh fungsi server. Bentuk sah: {pemilik} dan {pemilik, admin}. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; u1 uuid; u2 uuid;
begin
  begin
    insert into auth.users (id, email) values (ua, 'a@uji.local');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    pa := public.buat_perusahaan('Warung Uji A', 'fnb');
    ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
    perform set_config('request.jwt.claims', ka, true);
    execute 'reset role';

    -- Fungsi server (peran pemilik tabel) menyisipkan dan mengubah rute; constraint berlaku untuk semua peran.
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'aturan', 'catatan', 'Uji Q-17 satu', '{}'::jsonb) returning id into u1;
    perform pg_temp.cek('usulan baru berisi pemilik', (select 'pemilik' = any(untuk_peran) from public.usulan where id = u1));

    begin
      update public.usulan set untuk_peran = array['admin'] where id = u1;
      perform pg_temp.cek('update ke {admin} ditolak', false, 'update lolos');
    exception when check_violation then perform pg_temp.cek('update ke {admin} ditolak', true);
             when others then perform pg_temp.cek('update ke {admin} ditolak', false, sqlstate || ' ' || sqlerrm);
    end;
    begin
      update public.usulan set untuk_peran = '{}'::text[] where id = u1;
      perform pg_temp.cek('update ke himpunan kosong ditolak', false, 'update lolos');
    exception when check_violation then perform pg_temp.cek('update ke himpunan kosong ditolak', true);
             when others then perform pg_temp.cek('update ke himpunan kosong ditolak', false, sqlstate || ' ' || sqlerrm);
    end;
    begin
      insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values (pa, 'aturan', 'catatan', 'Uji Q-17 dua', '{}'::jsonb, array['admin']);
      perform pg_temp.cek('insert {admin} ditolak', false, 'insert lolos');
    exception when check_violation then perform pg_temp.cek('insert {admin} ditolak', true);
             when others then perform pg_temp.cek('insert {admin} ditolak', false, sqlstate || ' ' || sqlerrm);
    end;

    update public.usulan set untuk_peran = array['pemilik'] where id = u1;
    perform pg_temp.cek('{pemilik} sah', (select untuk_peran = array['pemilik'] from public.usulan where id = u1));
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, untuk_peran) values (pa, 'aturan', 'catatan', 'Uji Q-17 tiga', '{}'::jsonb, array['pemilik', 'admin'])
      returning id into u2;
    perform pg_temp.cek('{pemilik, admin} sah', u2 is not null);
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
