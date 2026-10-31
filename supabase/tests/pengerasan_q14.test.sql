-- Tes Q-14 (docs/quality/keamanan-f0.md A6 dan RENDAH): token MCP tanpa resource ditolak (audiens wajib), pengguna tidak bisa
-- membatalkan pencabutan token, endpoint push hanya ke host layanan push yang dikenal. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; ka text; tk uuid; r jsonb; n int;
  tok text := 'nmc_uji_q14_' || md5(random()::text);
  res text := 'https://nadi.contoh.id/api/mcp';
begin
  insert into auth.users (id, email) values (ua, 'q14@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji Q14', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  execute 'reset role';
  insert into public.mcp_token (token_hash, jenis, user_id, perusahaan_id, client_id, nama_klien, cakupan, resource, petunjuk, kedaluwarsa_at)
  values (app.hash_token(tok), 'akses', ua, pa, 'https://klien.contoh.id/k.json', 'Asisten Uji', array['nadi.baca'], res, 'q14', now() + interval '1 hour')
  returning id into tk;

  -- Audiens token wajib cocok; resource null tidak boleh melewati pemeriksaan.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.mcp_siapa_saya(tok, res);
  perform pg_temp.cek('token dengan resource yang benar diterima', r is not null, r::text);
  begin
    r := public.mcp_siapa_saya(tok, null);
    perform pg_temp.cek('resource null ditolak', false, r::text);
  exception when others then perform pg_temp.cek('resource null ditolak', sqlstate = 'P0401', sqlerrm);
  end;
  begin
    r := public.mcp_siapa_saya(tok, 'https://lain.contoh.id/api/mcp');
    perform pg_temp.cek('resource lain ditolak', false, r::text);
  exception when others then perform pg_temp.cek('resource lain ditolak', sqlstate = 'P0401', sqlerrm);
  end;

  -- Pencabutan token tidak bisa dibatalkan pengguna.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  update public.mcp_token set dicabut_at = now() where id = tk;
  begin
    update public.mcp_token set dicabut_at = null where id = tk;
  exception when others then null;
  end;
  execute 'reset role';
  perform pg_temp.cek('pencabutan token tetap berlaku', (select dicabut_at is not null from public.mcp_token where id = tk));

  -- Endpoint push hanya ke host layanan push yang dikenal.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    insert into public.langganan_push (endpoint, p256dh, auth) values ('https://169.254.169.254/latest/meta-data', 'k', 'a');
    perform pg_temp.cek('endpoint push ke host internal ditolak', false);
  exception when others then perform pg_temp.cek('endpoint push ke host internal ditolak', sqlstate = '23514', sqlerrm);
  end;
  begin
    insert into public.langganan_push (endpoint, p256dh, auth) values ('https://fcm.googleapis.com.jahat.example/x', 'k', 'a');
    perform pg_temp.cek('endpoint push tiruan akhiran ditolak', false);
  exception when others then perform pg_temp.cek('endpoint push tiruan akhiran ditolak', sqlstate = '23514', sqlerrm);
  end;
  insert into public.langganan_push (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/q14', 'k', 'a');
  insert into public.langganan_push (endpoint, p256dh, auth) values ('https://wns2-bl2p.notify.windows.com/w/?token=q14', 'k', 'a');
  select count(*) into n from public.langganan_push where perusahaan_id = pa;
  perform pg_temp.cek('endpoint FCM dan WNS diterima', n = 2, n::text);
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
