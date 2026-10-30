-- Server MCP (spesifikasi 2026-07-28) dan server otorisasi OAuth 2.1 untuk asisten AI milik pelanggan (docs/research/mcp.md).
-- Token buram, hanya sha256-nya disimpan. Setiap token terikat ke satu pengguna, satu usaha, cakupan, dan resource (audiens RFC 8707).
-- Server Next memanggil RPC ini dengan kunci publishable (anon); semua pemeriksaan ada di sini, tanpa service-role key.

create table public.oauth_klien (
  client_id text primary key default ('nkc_' || encode(extensions.gen_random_bytes(16), 'hex')),
  nama text not null check (char_length(nama) between 1 and 80),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 5),
  dibuat_at timestamptz not null default now()
);
comment on table public.oauth_klien is 'Klien hasil pendaftaran dinamis (RFC 7591, usang di MCP 2026-07-28, dipertahankan untuk klien lama). Klien CIMD tidak disimpan: dokumennya diambil dan divalidasi server saat otorisasi.';

create table public.oauth_kode (
  kode_hash text primary key,
  client_id text not null,
  nama_klien text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  cakupan text[] not null,
  resource text not null,
  kedaluwarsa_at timestamptz not null,
  dipakai_at timestamptz
);
create index on public.oauth_kode (user_id);
create index on public.oauth_kode (perusahaan_id);

create table public.mcp_token (
  id uuid primary key default app.uuid7(),
  token_hash text not null unique,
  jenis text not null check (jenis in ('akses', 'segar')),
  user_id uuid not null references auth.users(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  client_id text not null,
  nama_klien text not null,
  cakupan text[] not null,
  resource text not null,
  petunjuk text not null,
  dibuat_at timestamptz not null default now(),
  kedaluwarsa_at timestamptz not null,
  dicabut_at timestamptz,
  dipakai_at timestamptz,
  menit_mulai timestamptz,
  panggilan_menit int not null default 0
);
create index on public.mcp_token (user_id);
create index on public.mcp_token (perusahaan_id);

alter table public.oauth_klien enable row level security;
alter table public.oauth_kode enable row level security;
alter table public.mcp_token enable row level security;
revoke all on public.oauth_klien, public.oauth_kode, public.mcp_token from anon, authenticated;
-- Pengguna melihat dan mencabut token miliknya sendiri di usaha aktif (halaman "AI milikmu"). Hash tidak ikut diberikan.
create policy mcp_token_milik on public.mcp_token for select to authenticated
  using (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()));
create policy mcp_token_cabut on public.mcp_token for update to authenticated
  using (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()))
  with check (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()));
grant select (id, jenis, client_id, nama_klien, cakupan, petunjuk, dibuat_at, kedaluwarsa_at, dicabut_at, dipakai_at) on public.mcp_token to authenticated;
grant update (dicabut_at) on public.mcp_token to authenticated;

create function app.hash_token(p text) returns text
language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(p, 'utf8')), 'hex') $$;

create function app.token_baru(p_awalan text) returns text
language sql volatile set search_path = '' as $$ select p_awalan || encode(extensions.gen_random_bytes(32), 'hex') $$;

create function app.redirect_aman(p text) returns boolean
language sql immutable set search_path = '' as $$
  select char_length(p) <= 300 and (p ~ '^https://[^\s#]+$' or p ~ '^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?(/[^\s#]*)?$')
$$;

-- Pendaftaran klien dinamis (RFC 7591). Anon DISENGAJA: klien belum punya identitas. Redirect dibatasi https/loopback.
create function public.oauth_daftar(p_nama text, p_redirects text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k public.oauth_klien; u text;
begin
  if p_redirects is null or cardinality(p_redirects) not between 1 and 5 then
    return jsonb_build_object('error', 'invalid_redirect_uri', 'error_description', 'redirect_uris wajib 1 sampai 5');
  end if;
  foreach u in array p_redirects loop
    if not app.redirect_aman(u) then
      return jsonb_build_object('error', 'invalid_redirect_uri', 'error_description', 'redirect_uri harus https atau loopback');
    end if;
  end loop;
  if (select count(*) from public.oauth_klien where dibuat_at > now() - interval '1 hour') >= 200 then
    return jsonb_build_object('error', 'temporarily_unavailable', 'error_description', 'terlalu banyak pendaftaran, coba lagi nanti');
  end if;
  insert into public.oauth_klien (nama, redirect_uris)
    values (left(coalesce(nullif(btrim(p_nama), ''), 'Asisten AI'), 80), p_redirects) returning * into k;
  return jsonb_build_object('client_id', k.client_id, 'client_name', k.nama, 'redirect_uris', k.redirect_uris,
    'token_endpoint_auth_method', 'none', 'grant_types', jsonb_build_array('authorization_code', 'refresh_token'), 'response_types', jsonb_build_array('code'));
end $$;

-- Info klien terdaftar (DCR) untuk halaman izin.
create function public.oauth_klien_info(p_client text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nama', nama, 'redirect_uris', redirect_uris) from public.oauth_klien where client_id = p_client
$$;

-- Halaman izin: pengguna yang sudah masuk menyetujui akses untuk satu usaha tempat ia anggota aktif.
-- Klien CIMD (client_id berupa URL https) sudah divalidasi server Next (dokumen diambil, client_id sama, redirect_uri terdaftar);
-- klien DCR diperiksa di sini. Pengguna hanya bisa menerbitkan kode untuk akunnya sendiri.
create function public.oauth_terbitkan_kode(p_client text, p_nama_klien text, p_redirect text, p_challenge text,
  p_cakupan text[], p_resource text, p_perusahaan uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); k public.oauth_klien; v_kode text; v_nama text := p_nama_klien;
begin
  if v_uid is null then raise exception 'Masuk dulu' using errcode = '28000'; end if;
  if not exists (select 1 from public.anggota where perusahaan_id = p_perusahaan and user_id = v_uid and aktif) then
    raise exception 'Kamu bukan anggota aktif usaha ini' using errcode = '42501';
  end if;
  if p_client ~ '^https://' then
    if not app.redirect_aman(p_redirect) then raise exception 'redirect_uri tidak diizinkan' using errcode = '22023'; end if;
  else
    select * into k from public.oauth_klien where client_id = p_client;
    if k.client_id is null or not (p_redirect = any (k.redirect_uris)) then raise exception 'Klien atau redirect_uri tidak dikenal' using errcode = '22023'; end if;
    v_nama := k.nama;
  end if;
  if p_challenge is null or p_challenge !~ '^[A-Za-z0-9_-]{43,128}$' then raise exception 'code_challenge tidak valid (wajib S256)' using errcode = '22023'; end if;
  if p_cakupan is null or cardinality(p_cakupan) = 0 or not (p_cakupan <@ array['nadi.baca', 'nadi.usul']) then raise exception 'Cakupan tidak dikenal' using errcode = '22023'; end if;
  if p_resource is null or p_resource !~ '^https?://[^\s#?]+/api/mcp$' then raise exception 'resource tidak valid' using errcode = '22023'; end if;
  v_kode := app.token_baru('nac_');
  insert into public.oauth_kode (kode_hash, client_id, nama_klien, user_id, perusahaan_id, redirect_uri, code_challenge, cakupan, resource, kedaluwarsa_at)
    values (app.hash_token(v_kode), p_client, left(coalesce(nullif(btrim(v_nama), ''), 'Asisten AI'), 80), v_uid, p_perusahaan, p_redirect,
            p_challenge, (select array_agg(distinct c order by c) from unnest(p_cakupan) c), p_resource, now() + interval '10 minutes');
  return v_kode;
end $$;

create function app.terbitkan_token(p_user uuid, p_pid uuid, p_client text, p_nama text, p_cakupan text[], p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_akses text := app.token_baru('nmc_'); v_segar text := app.token_baru('nmr_');
begin
  insert into public.mcp_token (token_hash, jenis, user_id, perusahaan_id, client_id, nama_klien, cakupan, resource, petunjuk, kedaluwarsa_at) values
    (app.hash_token(v_akses), 'akses', p_user, p_pid, p_client, p_nama, p_cakupan, p_resource, '...' || right(v_akses, 4), now() + interval '30 days'),
    (app.hash_token(v_segar), 'segar', p_user, p_pid, p_client, p_nama, p_cakupan, p_resource, '...' || right(v_segar, 4), now() + interval '90 days');
  return jsonb_build_object('access_token', v_akses, 'token_type', 'Bearer', 'expires_in', 30 * 86400,
    'refresh_token', v_segar, 'scope', array_to_string(p_cakupan, ' '));
end $$;

-- Titik token: tukar kode (PKCE S256). Anon DISENGAJA: titik token tidak punya sesi pengguna.
-- Kode sekali pakai; verifier salah tetap menghanguskan kode (galat dikembalikan sebagai hasil agar update tidak dibatalkan).
create function public.oauth_tukar(p_kode text, p_client text, p_redirect text, p_verifier text, p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k public.oauth_kode;
begin
  if p_kode is null or p_verifier is null or char_length(p_verifier) not between 43 and 128 then
    return jsonb_build_object('error', 'invalid_grant');
  end if;
  update public.oauth_kode set dipakai_at = now()
   where kode_hash = app.hash_token(p_kode) and dipakai_at is null and kedaluwarsa_at > now()
     and client_id = p_client and redirect_uri = p_redirect
  returning * into k;
  if k.kode_hash is null then return jsonb_build_object('error', 'invalid_grant'); end if;
  if translate(rtrim(encode(sha256(convert_to(p_verifier, 'utf8')), 'base64'), '='), '+/', '-_') <> k.code_challenge then
    return jsonb_build_object('error', 'invalid_grant', 'error_description', 'PKCE tidak cocok');
  end if;
  if p_resource is not null and p_resource <> k.resource then return jsonb_build_object('error', 'invalid_target'); end if;
  if not exists (select 1 from public.anggota where perusahaan_id = k.perusahaan_id and user_id = k.user_id and aktif) then
    return jsonb_build_object('error', 'invalid_grant', 'error_description', 'keanggotaan tidak aktif');
  end if;
  return app.terbitkan_token(k.user_id, k.perusahaan_id, k.client_id, k.nama_klien, k.cakupan, k.resource);
end $$;

-- Token penyegar: rotasi sekali pakai. Anon DISENGAJA (titik token).
create function public.oauth_segarkan(p_segar text, p_client text, p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.mcp_token;
begin
  update public.mcp_token set dicabut_at = now()
   where token_hash = app.hash_token(coalesce(p_segar, '')) and jenis = 'segar' and dicabut_at is null and kedaluwarsa_at > now()
     and client_id = p_client
  returning * into t;
  if t.id is null then return jsonb_build_object('error', 'invalid_grant'); end if;
  if p_resource is not null and p_resource <> t.resource then return jsonb_build_object('error', 'invalid_target'); end if;
  if not exists (select 1 from public.anggota where perusahaan_id = t.perusahaan_id and user_id = t.user_id and aktif) then
    return jsonb_build_object('error', 'invalid_grant', 'error_description', 'keanggotaan tidak aktif');
  end if;
  return app.terbitkan_token(t.user_id, t.perusahaan_id, t.client_id, t.nama_klien, t.cakupan, t.resource);
end $$;

-- Konteks token untuk satu panggilan MCP. Kode galat: P0401 token tidak sah (HTTP 401), P0403 cakupan kurang (HTTP 403),
-- P0429 terlalu sering. Batas 120 panggilan per menit per token.
create function app.mcp_konteks(p_token text, p_resource text, p_cakupan text default 'nadi.baca')
returns table (user_id uuid, perusahaan_id uuid, peran text, cakupan text[], nama_klien text)
language plpgsql security definer set search_path = '' as $$
declare t public.mcp_token; v_peran text;
begin
  select * into t from public.mcp_token m
   where m.token_hash = app.hash_token(coalesce(p_token, '')) and m.jenis = 'akses' and m.dicabut_at is null and m.kedaluwarsa_at > now();
  if t.id is null or t.resource <> p_resource then raise exception 'Token tidak sah' using errcode = 'P0401'; end if;
  select a.peran into v_peran from public.anggota a where a.perusahaan_id = t.perusahaan_id and a.user_id = t.user_id and a.aktif;
  if v_peran is null then raise exception 'Token tidak sah' using errcode = 'P0401'; end if;
  if not (p_cakupan = any (t.cakupan)) then raise exception 'Butuh cakupan %', p_cakupan using errcode = 'P0403'; end if;
  update public.mcp_token m
     set dipakai_at = now(),
         menit_mulai = case when m.menit_mulai is null or m.menit_mulai < now() - interval '1 minute' then now() else m.menit_mulai end,
         panggilan_menit = case when m.menit_mulai is null or m.menit_mulai < now() - interval '1 minute' then 1 else m.panggilan_menit + 1 end
   where m.id = t.id
  returning m.panggilan_menit into t.panggilan_menit;
  if t.panggilan_menit > 120 then raise exception 'Terlalu banyak panggilan, tunggu sebentar' using errcode = 'P0429'; end if;
  return query select t.user_id, t.perusahaan_id, v_peran, t.cakupan, t.nama_klien;
end $$;

-- ===== Alat MCP =====

create function public.mcp_siapa_saya(p_token text, p_resource text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from app.mcp_konteks(p_token, p_resource);
  return jsonb_build_object(
    'usaha', (select jsonb_build_object('nama', p.nama, 'industri', p.industri, 'zona_waktu', p.zona_waktu) from public.perusahaan p where p.id = k.perusahaan_id),
    'peran', k.peran, 'cakupan', k.cakupan, 'klien', k.nama_klien,
    'usulan_menunggu', (select count(*) from public.usulan u where u.perusahaan_id = k.perusahaan_id and u.status = 'menunggu'),
    'orang_aktif', (select count(*) from public.orang o where o.perusahaan_id = k.perusahaan_id and o.status = 'aktif'));
end $$;

create function public.mcp_daftar_orang(p_token text, p_resource text, p_cari text default null, p_batas int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from app.mcp_konteks(p_token, p_resource);
  if k.peran not in ('pemilik', 'admin') then raise exception 'Daftar orang hanya untuk pemilik dan admin' using errcode = 'P0403'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama, 'id_staf', o.id_staf, 'jenis', o.jenis, 'status', o.status,
                     'jabatan', o.data ->> 'jabatan') order by o.nama)
      from (select * from public.orang o where o.perusahaan_id = k.perusahaan_id and o.status <> 'keluar'
              and (p_cari is null or o.nama ilike '%' || replace(replace(p_cari, '%', ''), '_', '') || '%')
             order by o.nama limit least(greatest(coalesce(p_batas, 50), 1), 200)) o), '[]'::jsonb);
end $$;

create function public.mcp_daftar_usulan(p_token text, p_resource text, p_status text default 'menunggu', p_batas int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from app.mcp_konteks(p_token, p_resource);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'judul', u.judul, 'aksi', u.aksi, 'sumber', u.sumber, 'status', u.status,
                     'dampak_rp', u.dampak_rp, 'keyakinan', u.keyakinan, 'dibuat_at', u.dibuat_at) order by u.dibuat_at desc)
      from (select * from public.usulan u where u.perusahaan_id = k.perusahaan_id
              and (p_status is null or u.status = p_status) and k.peran = any (u.untuk_peran || array['pemilik'])
             order by u.dibuat_at desc limit least(greatest(coalesce(p_batas, 20), 1), 100)) u), '[]'::jsonb);
end $$;

-- Tulisan dari AI luar selalu menjadi usulan yang harus disetujui pemilik/admin di Nadi.
create function public.mcp_buat_usulan(p_token text, p_resource text, p_aksi text, p_judul text, p_penjelasan text,
  p_bidang jsonb, p_dampak_rp numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; v_id uuid;
begin
  select * into k from app.mcp_konteks(p_token, p_resource, 'nadi.usul');
  if p_aksi is null or p_aksi not in ('orang.buat', 'uang.keluar', 'izin.sakit', 'catatan') then
    raise exception 'Aksi tidak dikenal. Pakai orang.buat, uang.keluar, izin.sakit, atau catatan' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_judul, ''))) not between 3 and 140 then raise exception 'Judul wajib 3 sampai 140 huruf' using errcode = '22023'; end if;
  if char_length(coalesce(p_penjelasan, '')) > 1000 then raise exception 'Penjelasan maksimal 1000 huruf' using errcode = '22023'; end if;
  if p_bidang is null or jsonb_typeof(p_bidang) <> 'object' or octet_length(p_bidang::text) > 20000 then
    raise exception 'bidang wajib objek JSON (maksimal 20 KB)' using errcode = '22023';
  end if;
  if p_aksi = 'orang.buat' and coalesce(p_bidang ->> 'nama', '') = '' then raise exception 'orang.buat butuh bidang.nama' using errcode = '22023'; end if;
  if p_aksi = 'izin.sakit' and (coalesce(p_bidang ->> 'nama', '') = '' or coalesce(p_bidang ->> 'mulai', '') = '') then
    raise exception 'izin.sakit butuh bidang.nama dan bidang.mulai (YYYY-MM-DD)' using errcode = '22023';
  end if;
  if p_dampak_rp is not null and p_dampak_rp < 0 then raise exception 'dampak_rp tidak boleh negatif' using errcode = '22023'; end if;
  if (select count(*) from public.usulan u where u.perusahaan_id = k.perusahaan_id and u.sumber = 'mcp' and u.dibuat_at > now() - interval '1 day') >= 200 then
    raise exception 'Batas 200 usulan per hari dari asisten AI tercapai' using errcode = 'P0429';
  end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp)
    values (k.perusahaan_id, 'mcp', p_aksi, btrim(p_judul),
            nullif(btrim(coalesce(p_penjelasan, '')), '') ,
            jsonb_build_object('bidang', p_bidang - 'nik', 'dari', jsonb_build_object('klien', k.nama_klien, 'oleh', k.user_id)),
            p_dampak_rp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'menunggu', 'catatan', 'Usulan masuk ke Feed Nadi dan menunggu persetujuan pemilik atau admin.');
end $$;

revoke all on function app.hash_token(text), app.token_baru(text), app.redirect_aman(text),
  app.terbitkan_token(uuid, uuid, text, text, text[], text), app.mcp_konteks(text, text, text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['oauth_daftar(text,text[])', 'oauth_tukar(text,text,text,text,text)', 'oauth_segarkan(text,text,text)',
    'mcp_siapa_saya(text,text)', 'mcp_daftar_orang(text,text,text,int)', 'mcp_daftar_usulan(text,text,text,int)',
    'mcp_buat_usulan(text,text,text,text,text,jsonb,numeric)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  foreach f in array array['oauth_klien_info(text)', 'oauth_terbitkan_kode(text,text,text,text,text[],text,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
comment on function public.oauth_tukar(text, text, text, text, text) is 'SECURITY DEFINER dan anon DISENGAJA: titik token OAuth tanpa sesi; kode sekali pakai, klien, redirect_uri, PKCE, resource, dan keanggotaan diperiksa sebelum token terbit.';
comment on function public.oauth_segarkan(text, text, text) is 'SECURITY DEFINER dan anon DISENGAJA: rotasi token penyegar sekali pakai, keanggotaan diperiksa ulang.';
comment on function public.oauth_daftar(text, text[]) is 'SECURITY DEFINER dan anon DISENGAJA: pendaftaran klien dinamis; redirect https/loopback, 200 per jam.';
comment on function public.mcp_buat_usulan(text, text, text, text, text, jsonb, numeric) is 'SECURITY DEFINER dan anon DISENGAJA: dipanggil server MCP dengan token buram pengguna; token, resource, cakupan nadi.usul, dan keanggotaan aktif diperiksa di app.mcp_konteks.';
