-- Tes mcp_lanjutan: usulan dari asisten AI yang disetujui mencatat kejadian bersumber mcp; ringkasan AI lewat MCP hanya untuk pengelola.
-- Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); pa uuid; o1 uuid; us uuid; res text := 'https://nadi.uji/api/mcp';
  ver text := repeat('v', 50); chal text; kode text; t jsonb; ts jsonb; r jsonb; u1 uuid; u2 uuid;
begin
  chal := translate(rtrim(encode(sha256(convert_to(ver, 'utf8')), 'base64'), '='), '+/', '-_');
  insert into auth.users (id, email) values (ua, 'a@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  kode := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca', 'nadi.usul'], res, pa);
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
  ts := jsonb_build_object('kode', public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca'], res, pa));

  execute 'reset role';
  execute 'set local role anon';
  t := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
  ts := public.oauth_tukar(ts ->> 'kode', 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
  r := public.mcp_ringkasan_ai(t ->> 'access_token', res, 30);
  perform pg_temp.cek('ringkasan_ai lewat MCP untuk pemilik', r ? 'token_hemat' and (r ->> 'hari')::int = 30, r::text);
  begin
    perform public.mcp_ringkasan_ai(ts ->> 'access_token', res, 30);
    perform pg_temp.cek('ringkasan_ai lewat MCP ditolak untuk staf', false);
  exception when others then perform pg_temp.cek('ringkasan_ai lewat MCP ditolak untuk staf', sqlstate = 'P0403', sqlerrm);
  end;
  u1 := (public.mcp_buat_usulan(t ->> 'access_token', res, 'catatan', 'Catat stok gula', null, '{"isi": "Stok gula 2 kg"}', null) ->> 'id')::uuid;
  u2 := (public.mcp_buat_usulan(t ->> 'access_token', res, 'orang.buat', 'Tambah Budi sebagai kasir', null, '{"nama": "BUDI"}', null) ->> 'id')::uuid;

  -- Pemilik menyetujui di Nadi.
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  r := public.putuskan_usulan(u1, true);
  perform pg_temp.cek('usulan catatan dari mcp disetujui', r ->> 'status' = 'diterima' and (r ->> 'dibuat')::int = 1, r::text);
  r := public.putuskan_usulan(u2, true);
  execute 'reset role';
  perform pg_temp.cek('kejadian dari usulan mcp bersumber mcp',
    (select count(*) = 1 from public.kejadian where perusahaan_id = pa and jenis = 'catatan' and sumber = 'mcp' and data ->> 'isi' = 'Stok gula 2 kg'));
  perform pg_temp.cek('orang dari usulan mcp ditandai sumber mcp',
    (select data ->> 'sumber' = 'mcp' and nama = 'Budi' from public.orang where perusahaan_id = pa and nama = 'Budi'));

  -- ringkasan_ai aplikasi tetap: pemilik dapat, staf tidak.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  perform pg_temp.cek('ringkasan_ai aplikasi untuk pemilik', public.ringkasan_ai(30) ? 'berkas_model');
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
  perform pg_temp.cek('ringkasan_ai aplikasi null untuk staf', public.ringkasan_ai(30) is null);
  begin
    perform app.ringkasan_ai_usaha(pa, 30);
    perform pg_temp.cek('inti ringkasan tidak bisa dipanggil langsung', false);
  exception when insufficient_privilege then perform pg_temp.cek('inti ringkasan tidak bisa dipanggil langsung', true);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
