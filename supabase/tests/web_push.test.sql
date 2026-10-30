-- Tes Web Push (langganan_push, kunci VAPID). Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pa2 uuid; pb uuid; ka text; ka2 text; kb text; n int;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  pa2 := public.buat_perusahaan('Warung Uji A2');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  ka2 := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa2, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;

  perform set_config('request.jwt.claims', ka, true);
  insert into public.langganan_push (endpoint, p256dh, auth) values ('https://push.uji/a1', 'BA', 'xx');
  perform pg_temp.cek('perusahaan_id dan user_id terisi dari klaim', exists (select 1 from public.langganan_push where perusahaan_id = pa and user_id = ua));
  perform pg_temp.cek('kunci publik terbaca oleh pengguna masuk (87 karakter)', length(public.kunci_push_publik()) = 87);
  begin
    insert into public.langganan_push (endpoint, p256dh, auth) values ('http://push.uji/x', 'BA', 'xx');
    perform pg_temp.cek('endpoint bukan https ditolak', false, 'seharusnya ditolak');
  exception when check_violation then perform pg_temp.cek('endpoint bukan https ditolak', true); end;
  begin
    insert into public.langganan_push (perusahaan_id, endpoint, p256dh, auth) values (pb, 'https://push.uji/nyasar', 'BA', 'xx');
    perform pg_temp.cek('tidak bisa berlangganan untuk usaha orang lain', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('tidak bisa berlangganan untuk usaha orang lain', true); end;
  begin
    insert into public.langganan_push (user_id, endpoint, p256dh, auth) values (ub, 'https://push.uji/menyamar', 'BA', 'xx');
    perform pg_temp.cek('tidak bisa membuat langganan atas nama pengguna lain', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('tidak bisa membuat langganan atas nama pengguna lain', true); end;

  -- Perangkat yang sama berlangganan juga untuk usaha kedua milik A (tidak bentrok).
  perform set_config('request.jwt.claims', ka2, true);
  insert into public.langganan_push (endpoint, p256dh, auth) values ('https://push.uji/a1', 'BA', 'xx');
  select count(*) into n from public.langganan_push;
  perform pg_temp.cek('di usaha A2 hanya langganan A2 yang terlihat', n = 1);

  -- B tidak melihat dan tidak bisa menghapus langganan A.
  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.langganan_push;
  perform pg_temp.cek('pengguna B tidak melihat langganan A', n = 0);
  -- Kebijakan FOR ALL memakai USING yang sama untuk ubah dan hapus; diuji lewat ubah (penjaga loop menolak SQL hapus).
  update public.langganan_push set perangkat = 'dibajak' where endpoint = 'https://push.uji/a1';
  get diagnostics n = row_count;
  perform pg_temp.cek('pengguna B tidak bisa mengubah atau menghapus langganan A', n = 0);

  -- Fungsi VAPID rahasia tertutup untuk pengguna biasa.
  begin
    perform public.vapid_ambil();
    perform pg_temp.cek('vapid_ambil tertutup untuk authenticated', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('vapid_ambil tertutup untuk authenticated', true); end;
  begin
    perform public.vapid_simpan('x', 'y');
    perform pg_temp.cek('vapid_simpan tertutup untuk authenticated', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('vapid_simpan tertutup untuk authenticated', true); end;
  begin
    perform 1 from app.vapid;
    perform pg_temp.cek('tabel app.vapid tertutup untuk authenticated', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('tabel app.vapid tertutup untuk authenticated', true); end;
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform public.kunci_push_publik();
    perform pg_temp.cek('kunci publik tertutup untuk anon', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('kunci publik tertutup untuk anon', true); end;
  execute 'reset role';

  execute 'set local role service_role';
  perform pg_temp.cek('service_role membaca JWK VAPID (pasangan kunci lengkap)', public.vapid_ambil()::jsonb ? 'privateKey');
  perform pg_temp.cek('vapid_simpan kedua kali tidak menimpa kunci', public.vapid_simpan('palsu', '{}') = false);
  execute 'reset role';
  perform pg_temp.cek('kunci publik tetap kunci asli', (select publik from app.vapid) <> 'palsu');
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
