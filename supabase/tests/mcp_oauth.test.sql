-- Tes mcp_oauth: alur OAuth (kode + PKCE + resource), token MCP, alat, peran, isolasi usaha.
-- Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; us uuid;
  res text := 'https://nadi.uji/api/mcp'; ver text := repeat('v', 50); chal text; kode text; kode2 text; t jsonb; t2 jsonb; ts jsonb;
  r jsonb; dcr jsonb; e text; n int;
begin
  chal := translate(rtrim(encode(sha256(convert_to(ver, 'utf8')), 'base64'), '='), '+/', '-_');
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;

  -- Kode untuk usaha orang lain ditolak.
  begin
    perform public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca'], res, pb);
    perform pg_temp.cek('kode untuk usaha bukan milik ditolak', false);
  exception when others then perform pg_temp.cek('kode untuk usaha bukan milik ditolak', sqlstate = '42501', sqlerrm);
  end;
  begin
    perform public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', 'pendek', array['nadi.baca'], res, pa);
    perform pg_temp.cek('challenge bukan S256 ditolak', false);
  exception when others then perform pg_temp.cek('challenge bukan S256 ditolak', sqlstate = '22023', sqlerrm);
  end;
  begin
    perform public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.semua'], res, pa);
    perform pg_temp.cek('cakupan asing ditolak', false);
  exception when others then perform pg_temp.cek('cakupan asing ditolak', sqlstate = '22023', sqlerrm);
  end;
  kode := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca', 'nadi.usul'], res, pa);
  kode2 := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca'], res, pa);

  -- Penukaran kode di titik token (anon).
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', repeat('x', 50), res);
  perform pg_temp.cek('verifier salah ditolak', r ->> 'error' = 'invalid_grant', r::text);
  r := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
  perform pg_temp.cek('verifier salah menghanguskan kode', r ->> 'error' = 'invalid_grant', r::text);
  r := public.oauth_tukar(kode2, 'https://klien.lain/meta.json', 'https://klien.uji/cb', ver, res);
  perform pg_temp.cek('client_id lain ditolak', r ->> 'error' = 'invalid_grant', r::text);
  -- kode2 belum terpakai karena klien salah tidak cocok; tukar dengan resource lain ditolak dan kode hangus.
  r := public.oauth_tukar(kode2, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, 'https://lain.uji/api/mcp');
  perform pg_temp.cek('resource lain ditolak', r ->> 'error' = 'invalid_target', r::text);

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  kode := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca', 'nadi.usul'], res, pa);
  kode2 := public.oauth_terbitkan_kode('https://klien.uji/meta.json', 'Klien Uji', 'https://klien.uji/cb', chal, array['nadi.baca'], res, pa);
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  t := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
  perform pg_temp.cek('kode benar menerbitkan token akses dan penyegar', t ->> 'access_token' like 'nmc\_%' and t ->> 'refresh_token' like 'nmr\_%' and t ->> 'scope' = 'nadi.baca nadi.usul', t::text);
  r := public.oauth_tukar(kode, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, res);
  perform pg_temp.cek('kode sekali pakai', r ->> 'error' = 'invalid_grant', r::text);
  t2 := public.oauth_tukar(kode2, 'https://klien.uji/meta.json', 'https://klien.uji/cb', ver, null);

  -- Alat.
  r := public.mcp_siapa_saya(t ->> 'access_token', res);
  perform pg_temp.cek('siapa_saya: usaha dan peran benar', r -> 'usaha' ->> 'nama' = 'Warung Uji A' and r ->> 'peran' = 'pemilik' and r ->> 'klien' = 'Klien Uji', r::text);
  begin
    perform public.mcp_siapa_saya(t ->> 'access_token', 'https://lain.uji/api/mcp');
    perform pg_temp.cek('token untuk resource lain ditolak (audiens)', false);
  exception when others then perform pg_temp.cek('token untuk resource lain ditolak (audiens)', sqlstate = 'P0401', sqlerrm);
  end;
  begin
    perform public.mcp_siapa_saya('nmc_palsu', res);
    perform pg_temp.cek('token palsu ditolak', false);
  exception when others then perform pg_temp.cek('token palsu ditolak', sqlstate = 'P0401', sqlerrm);
  end;
  begin
    perform public.mcp_siapa_saya(t ->> 'refresh_token', res);
    perform pg_temp.cek('token penyegar tidak bisa dipakai sebagai token akses', false);
  exception when others then perform pg_temp.cek('token penyegar tidak bisa dipakai sebagai token akses', sqlstate = 'P0401', sqlerrm);
  end;
  r := public.mcp_buat_usulan(t ->> 'access_token', res, 'orang.buat', 'Tambah Budi sebagai kasir', 'Dari obrolan pemilik', '{"nama": "Budi", "nik": "5171010101010001"}', null);
  execute 'reset role';
  perform pg_temp.cek('buat_usulan masuk sebagai usulan menunggu dari mcp tanpa NIK',
    (select status = 'menunggu' and sumber = 'mcp' and perusahaan_id = pa and not (payload -> 'bidang' ? 'nik') and payload -> 'dari' ->> 'klien' = 'Klien Uji'
       from public.usulan where id = (r ->> 'id')::uuid), r::text);
  execute 'set local role anon';
  begin
    perform public.mcp_buat_usulan(t2 ->> 'access_token', res, 'catatan', 'Catatan uji', null, '{}', null);
    perform pg_temp.cek('token tanpa nadi.usul tidak bisa membuat usulan', false);
  exception when others then perform pg_temp.cek('token tanpa nadi.usul tidak bisa membuat usulan', sqlstate = 'P0403', sqlerrm);
  end;
  begin
    perform public.mcp_buat_usulan(t ->> 'access_token', res, 'gaji.bayar', 'Bayar gaji', null, '{}', 1000);
    perform pg_temp.cek('aksi di luar daftar putih ditolak', false);
  exception when others then perform pg_temp.cek('aksi di luar daftar putih ditolak', sqlstate = '22023', sqlerrm);
  end;
  r := public.mcp_daftar_usulan(t ->> 'access_token', res, 'menunggu', 10);
  perform pg_temp.cek('daftar_usulan melihat usulan usaha sendiri', jsonb_array_length(r) = 1, r::text);
  r := public.mcp_daftar_orang(t ->> 'access_token', res, null, 10);
  perform pg_temp.cek('daftar_orang untuk pemilik', r @> '[{"nama": "Sari"}]', r::text);

  -- Rotasi token penyegar.
  ts := public.oauth_segarkan(t ->> 'refresh_token', 'https://klien.uji/meta.json', res);
  perform pg_temp.cek('penyegar menerbitkan pasangan baru', ts ->> 'access_token' like 'nmc\_%' and ts ->> 'access_token' <> t ->> 'access_token', ts::text);
  r := public.oauth_segarkan(t ->> 'refresh_token', 'https://klien.uji/meta.json', res);
  perform pg_temp.cek('penyegar sekali pakai', r ->> 'error' = 'invalid_grant', r::text);

  -- Pendaftaran klien dinamis.
  dcr := public.oauth_daftar('Klien Lama', array['http://localhost:3999/cb']);
  perform pg_temp.cek('DCR loopback diterima', dcr ->> 'client_id' like 'nkc\_%', dcr::text);
  r := public.oauth_daftar('Jahat', array['http://jahat.uji/cb']);
  perform pg_temp.cek('DCR http non-loopback ditolak', r ->> 'error' = 'invalid_redirect_uri', r::text);

  -- Staf: token staf tidak melihat daftar orang.
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text, true);
  begin
    perform public.oauth_terbitkan_kode(dcr ->> 'client_id', 'nama palsu', 'http://localhost:4000/lain', chal, array['nadi.baca'], res, pa);
    perform pg_temp.cek('DCR: redirect di luar daftar ditolak', false);
  exception when others then perform pg_temp.cek('DCR: redirect di luar daftar ditolak', sqlstate = '22023', sqlerrm);
  end;
  kode := public.oauth_terbitkan_kode(dcr ->> 'client_id', 'nama palsu', 'http://localhost:3999/cb', chal, array['nadi.baca'], res, pa);
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.oauth_tukar(kode, dcr ->> 'client_id', 'http://localhost:3999/cb', ver, res);
  perform pg_temp.cek('nama klien DCR dari pendaftaran, bukan dari halaman', public.mcp_siapa_saya(r ->> 'access_token', res) ->> 'klien' = 'Klien Lama', r::text);
  begin
    perform public.mcp_daftar_orang(r ->> 'access_token', res, null, 10);
    perform pg_temp.cek('staf tidak bisa daftar_orang', false);
  exception when others then perform pg_temp.cek('staf tidak bisa daftar_orang', sqlstate = 'P0403', sqlerrm);
  end;

  -- Anggota dinonaktifkan: token langsung tidak berlaku.
  execute 'reset role';
  update public.anggota set aktif = false where perusahaan_id = pa and user_id = us;
  execute 'set local role anon';
  begin
    perform public.mcp_siapa_saya(r ->> 'access_token', res);
    perform pg_temp.cek('anggota nonaktif: token ditolak', false);
  exception when others then perform pg_temp.cek('anggota nonaktif: token ditolak', sqlstate = 'P0401', sqlerrm);
  end;

  -- Anon tidak bisa membaca tabel token atau memanggil fungsi internal.
  begin
    perform count(*) from public.mcp_token;
    perform pg_temp.cek('anon tidak bisa membaca mcp_token', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membaca mcp_token', true);
  end;
  begin
    perform app.mcp_konteks(t ->> 'access_token', res);
    perform pg_temp.cek('anon tidak bisa memanggil app.mcp_konteks', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa memanggil app.mcp_konteks', true);
  end;

  -- Pemilik melihat tokennya sendiri lewat RLS, tanpa hash; pengguna lain tidak.
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text, true);
  select count(*) into n from public.mcp_token;
  perform pg_temp.cek('pemilik melihat tokennya (2 akses + 2 penyegar terbit, 1 penyegar lama)', n = 6, n::text);
  begin
    perform token_hash from public.mcp_token limit 1;
    perform pg_temp.cek('hash token tidak bisa dibaca', false);
  exception when insufficient_privilege then perform pg_temp.cek('hash token tidak bisa dibaca', true);
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text, true);
  select count(*) into n from public.mcp_token;
  perform pg_temp.cek('usaha B tidak melihat token usaha A', n = 0, n::text);
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
