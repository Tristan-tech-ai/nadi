-- Tes token_kios: tablet tanpa akun hanya bisa meminta kode absen lewat token; token dicabut atau salah ditolak; kode sama dengan
-- kode kios pemilik; staf tidak bisa membuat token; isolasi usaha; tabel token tertutup. Lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o1 uuid; us uuid;
  tp uuid; r jsonb; ta jsonb; tb jsonb; kode_pemilik text; n int;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B', 'toko');
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', kb, true);
  tb := public.buat_token_kios('Tablet B');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  ta := public.buat_token_kios('Tablet pintu depan');
  tp := public.tempat_absen_utama();
  perform pg_temp.cek('token mentah berawalan nmk_ dan 64 heksa', ta ->> 'token' ~ '^nmk_[0-9a-f]{64}$', left(ta ->> 'token', 6));
  select count(*) into n from public.daftar_token_kios();
  perform pg_temp.cek('daftar tablet hanya milik usaha sendiri', n = 1, n::text);
  perform pg_temp.cek('daftar tablet tanpa hash atau token', not exists (select 1 from public.daftar_token_kios() d where to_jsonb(d)::text ~ 'nmk_|hash'));
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  select user_id into us from public.orang where id = o1;
  ks := json_build_object('sub', us, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform public.buat_token_kios('Tablet staf');
    perform pg_temp.cek('staf tidak bisa membuat token tablet', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa membuat token tablet', true);
  end;
  begin
    perform public.cabut_token_kios((ta ->> 'id')::uuid);
    perform pg_temp.cek('staf tidak bisa mencabut token tablet', false);
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa mencabut token tablet', true);
  end;

  -- Tablet tanpa akun.
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  r := public.kode_absen_kios(ta ->> 'token');
  perform pg_temp.cek('tablet tanpa akun mendapat kode 6 angka untuk tempat usahanya', r ->> 'kode' ~ '^\d{6}$' and (r ->> 'tempat')::uuid = tp, r::text);
  perform pg_temp.cek('tablet tidak menerima rahasia', not (r ? 'rahasia') and r::text !~ '\\x');
  begin
    perform public.kode_absen_kios('nmk_' || repeat('0', 64));
    perform pg_temp.cek('token karangan ditolak', false);
  exception when others then perform pg_temp.cek('token karangan ditolak', sqlerrm like 'Tautan tablet ini tidak berlaku%', sqlerrm);
  end;
  begin
    perform public.kode_absen_kios(null);
    perform pg_temp.cek('token kosong ditolak', false);
  exception when others then perform pg_temp.cek('token kosong ditolak', sqlerrm like 'Tautan tablet ini tidak berlaku%', sqlerrm);
  end;
  begin
    perform public.buat_token_kios('x');
    perform pg_temp.cek('anon tidak bisa membuat token', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa membuat token', true);
  end;
  begin
    perform public.kode_absen(tp);
    perform pg_temp.cek('anon tidak bisa memakai jalur kios pemilik', false);
  exception when insufficient_privilege then perform pg_temp.cek('anon tidak bisa memakai jalur kios pemilik', true);
  end;
  begin
    perform count(*) from app.token_kios;
    perform pg_temp.cek('tabel token tertutup untuk anon', false);
  exception when insufficient_privilege then perform pg_temp.cek('tabel token tertutup untuk anon', true);
  end;
  r := public.kode_absen_kios(tb ->> 'token');
  perform pg_temp.cek('token usaha B memberi tempat usaha B, bukan A', (r ->> 'tempat')::uuid <> tp, r::text);

  -- Kode tablet sama dengan kode kios pemilik pada langkah yang sama.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  kode_pemilik := public.kode_absen(tp) ->> 'kode';
  r := public.kode_absen_kios(ta ->> 'token');
  perform pg_temp.cek('kode tablet sama dengan kode kios pemilik', r ->> 'kode' = kode_pemilik or (r ->> 'sisa_detik')::int = 15);
  execute 'reset role';
  perform pg_temp.cek('dipakai_at tercatat', (select dipakai_at is not null from app.token_kios where id = (ta ->> 'id')::uuid));
  perform pg_temp.cek('hash yang disimpan bukan token mentah', not exists (select 1 from app.token_kios where hash like 'nmk_%'));

  -- Usaha lain tidak bisa mencabut; pemilik bisa, lalu token ditolak.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha lain tidak bisa mencabut token', not public.cabut_token_kios((ta ->> 'id')::uuid));
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('pemilik mencabut token', public.cabut_token_kios((ta ->> 'id')::uuid));
  select count(*) into n from public.daftar_token_kios();
  perform pg_temp.cek('token dicabut hilang dari daftar', n = 0, n::text);
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.kode_absen_kios(ta ->> 'token');
    perform pg_temp.cek('token dicabut ditolak', false);
  exception when others then perform pg_temp.cek('token dicabut ditolak', sqlerrm like 'Tautan tablet ini tidak berlaku%', sqlerrm);
  end;
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
