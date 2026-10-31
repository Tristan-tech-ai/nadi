-- Tes push usulan (kirim_push_usulan, target_push, push_token_cocok). Permintaan pg_net baru dikirim setelah commit,
-- dan transaksi ini dibatalkan di akhir lewat RAISE EXCEPTION, jadi tidak ada pemberitahuan sungguhan. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; us uuid; n int; antre_awal bigint;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  insert into public.langganan_push (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/uji-pemilik-a', 'BA', 'xx');
  execute 'reset role';
  us := (select user_id from public.orang where id = o1);
  insert into public.langganan_push (perusahaan_id, user_id, endpoint, p256dh, auth) values (pa, us, 'https://fcm.googleapis.com/fcm/send/uji-staf-a', 'BA', 'xx');

  select count(*) into n from public.target_push(pa, array['pemilik', 'admin']);
  perform pg_temp.cek('target hanya pemilik/admin, staf tidak ikut', n = 1 and exists (select 1 from public.target_push(pa, array['pemilik', 'admin']) where endpoint = 'https://fcm.googleapis.com/fcm/send/uji-pemilik-a'));
  perform pg_temp.cek('token salah ditolak', not public.push_token_cocok('salah'));

  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'lempar', 'uang.keluar', 'Catat belanja A1', '{}'), (pa, 'lempar', 'uang.keluar', 'Catat belanja A2', '{}'), (pb, 'lempar', 'uang.keluar', 'Catat belanja B1', '{}');
  select count(*) into antre_awal from net.http_request_queue;
  perform app.kirim_push_usulan();
  perform pg_temp.cek('usulan A dan B ditandai sudah diberitahu', not exists (select 1 from public.usulan where perusahaan_id in (pa, pb) and diberitahu_at is null));
  perform pg_temp.cek('satu permintaan per usaha (A digabung 2 usulan jadi 1 kiriman)', (select count(*) from net.http_request_queue) - antre_awal >= 2
    and exists (select 1 from net.http_request_queue where convert_from(body, 'UTF8')::jsonb ->> 'perusahaan_id' = pa::text and (convert_from(body, 'UTF8')::jsonb ->> 'jumlah')::int = 2));
  perform pg_temp.cek('permintaan membawa token, bukan kunci API', exists (select 1 from net.http_request_queue where headers ? 'x-nadi-token' and not headers ? 'apikey' and not headers ? 'Authorization'));

  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values (pa, 'lempar', 'uang.keluar', 'Catat belanja A3', '{}');
  perform app.kirim_push_usulan();
  perform pg_temp.cek('usulan baru dalam 5 menit ditahan, tidak dikirim lagi', exists (select 1 from public.usulan where judul = 'Catat belanja A3' and diberitahu_at is null));
  update app.push_terakhir set dikirim_at = now() - interval '6 minutes' where perusahaan_id = pa;
  perform app.kirim_push_usulan();
  perform pg_temp.cek('setelah 5 menit usulan yang ditahan dikirim', exists (select 1 from public.usulan where judul = 'Catat belanja A3' and diberitahu_at is not null));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  begin
    perform public.target_push(pa, array['pemilik']);
    perform pg_temp.cek('target_push tertutup untuk pengguna', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('target_push tertutup untuk pengguna', true); end;
  begin
    perform public.push_token_cocok('x');
    perform pg_temp.cek('push_token_cocok tertutup untuk pengguna', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('push_token_cocok tertutup untuk pengguna', true); end;
  begin
    perform app.kirim_push_usulan();
    perform pg_temp.cek('kirim_push_usulan tertutup untuk pengguna', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('kirim_push_usulan tertutup untuk pengguna', true); end;
  execute 'reset role';
  perform pg_temp.cek('jadwal cron terpasang tiap menit', exists (select 1 from cron.job where jobname = 'nadi-push-usulan' and schedule = '* * * * *'));
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
