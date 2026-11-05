-- M-21 akses dan keamanan: 2FA TOTP (Supabase MFA, gratis, aktif di semua proyek; docs dibaca 6 Nov 2026) ditegakkan di database:
-- pengguna yang punya faktor terverifikasi tetapi sesinya baru aal1 tidak mendapat usaha aktif dari app.pid(), sehingga semua kebijakan
-- tenant (dan app.peran_aktif) tertutup sampai kode 2FA dimasukkan (pola docs "enforce MFA" dengan auth.mfa_factors, dipasang di satu
-- fungsi pusat, bukan per tabel). Peran kustom per izin untuk anggota bukan pemilik/admin (katalog izin tetap), log aktivitas pengguna
-- (masuk, keluar, 2FA, cabut sesi) yang bisa dibaca pemiliknya dan pengelola usaha, daftar sesi perangkat milik sendiri.

create or replace function app.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke all on function app.mfa_ok() from public;
grant execute on function app.mfa_ok() to anon, authenticated;

create or replace function app.pid() returns uuid
language sql stable set search_path = '' as $$
  select case when app.mfa_ok() then nullif(auth.jwt() -> 'app_metadata' ->> 'pid', '')::uuid end;
$$;

-- Katalog izin peran kustom. Pemilik dan admin selalu punya semuanya.
create or replace function app.permission_catalog() returns text[]
language sql immutable set search_path = '' as $$ select array['stok.lihat', 'stok.ubah']::text[] $$;

create table public.custom_role (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  permissions text[] not null default '{}' check (permissions <@ app.permission_catalog()),
  dibuat_at timestamptz not null default now()
);
create unique index custom_role_nama on public.custom_role (perusahaan_id, lower(name));
alter table public.anggota add column custom_role_id uuid references public.custom_role(id) on delete set null;

alter table public.custom_role enable row level security;
create policy custom_role_baca on public.custom_role for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
grant select on public.custom_role to authenticated;

create or replace function app.izin(p_izin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.peran_aktif() in ('pemilik', 'admin'), false)
      or exists (select 1 from public.anggota a join public.custom_role r on r.id = a.custom_role_id
                  where a.perusahaan_id = app.pid() and a.user_id = auth.uid() and a.aktif and p_izin = any (r.permissions))
$$;
revoke all on function app.izin(text) from public, anon;
grant execute on function app.izin(text) to authenticated;

-- Stok: izin stok.ubah membuka RPC produk, stok, dan produksi; stok.lihat membuka baca stok dan kartu stok.
create or replace function app.wajib_stok() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or not (coalesce((select app.peran_aktif()), '') in ('pemilik', 'admin') or app.izin('stok.ubah')) then
    raise exception 'Hanya pemilik atau admin yang mengubah produk dan stok' using errcode = '42501';
  end if;
  return v_pid;
end $$;
alter policy stok_baca on public.stok
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or (select app.izin('stok.lihat'))));
alter policy gerak_stok_baca on public.gerak_stok
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or (select app.izin('stok.lihat'))));

create or replace function public.save_custom_role(p_id uuid, p_nama text, p_izin text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengatur peran kustom' using errcode = '42501';
  end if;
  if not (coalesce(p_izin, '{}') <@ app.permission_catalog()) then raise exception 'Izin tidak dikenal' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.custom_role (perusahaan_id, name, permissions) values (v_pid, btrim(p_nama), coalesce(p_izin, '{}')) returning id into v_id;
  else
    update public.custom_role set name = btrim(p_nama), permissions = coalesce(p_izin, '{}') where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Peran tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- Peran kustom hanya untuk staf dan akuntan; pemilik/admin sudah punya semua izin.
create or replace function public.assign_custom_role(p_user uuid, p_role uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang memberi peran kustom' using errcode = '42501';
  end if;
  if p_role is not null and not exists (select 1 from public.custom_role where id = p_role and perusahaan_id = v_pid) then
    raise exception 'Peran tidak ditemukan' using errcode = 'P0002';
  end if;
  update public.anggota set custom_role_id = p_role where perusahaan_id = v_pid and user_id = p_user and peran in ('staf', 'akuntan');
  if not found then raise exception 'Anggota staf atau akuntan tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

create table public.activity_log (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid references public.perusahaan(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('masuk', 'keluar', '2fa.lolos', '2fa.aktif', '2fa.nonaktif', 'sesi.cabut')),
  ip text check (ip is null or char_length(ip) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  at timestamptz not null default now()
);
create index activity_log_user on public.activity_log (user_id, at desc);
create index activity_log_usaha on public.activity_log (perusahaan_id, at desc);
alter table public.activity_log enable row level security;
create policy activity_log_baca on public.activity_log for select to authenticated
  using (user_id = (select auth.uid()) or (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin')));
grant select on public.activity_log to authenticated;

-- Dicatat aplikasi untuk pengguna yang sedang masuk. Usaha diambil dari klaim (sebelum 2FA app.pid masih kosong). Alamat dan
-- perangkat dikirim server Next dari kepala permintaan peramban; batas 30 catatan per menit per pengguna.
create or replace function public.log_activity(p_kind text, p_ip text, p_ua text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Masuk dulu' using errcode = '42501'; end if;
  if (select count(*) from public.activity_log where user_id = v_uid and at > now() - interval '1 minute') >= 30 then return; end if;
  insert into public.activity_log (perusahaan_id, user_id, kind, ip, user_agent)
  values (nullif(auth.jwt() -> 'app_metadata' ->> 'pid', '')::uuid, v_uid, p_kind, left(nullif(btrim(coalesce(p_ip, '')), ''), 64), left(nullif(btrim(coalesce(p_ua, '')), ''), 300));
end $$;

-- Sesi perangkat milik sendiri (Supabase Auth), sesi ini ditandai.
create or replace function public.my_sessions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'dibuat', s.created_at, 'aktif', coalesce(s.refreshed_at at time zone 'UTC', s.updated_at), 'aal', s.aal,
           'perangkat', left(s.user_agent, 200), 'ip', host(s.ip), 'ini', s.id::text = auth.jwt() ->> 'session_id') order by coalesce(s.refreshed_at at time zone 'UTC', s.updated_at) desc), '[]')
    from auth.sessions s where s.user_id = auth.uid() and (s.not_after is null or s.not_after > now())
$$;

revoke all on function public.save_custom_role(uuid, text, text[]), public.assign_custom_role(uuid, uuid), public.log_activity(text, text, text), public.my_sessions() from public, anon;
grant execute on function public.save_custom_role(uuid, text, text[]), public.assign_custom_role(uuid, uuid), public.log_activity(text, text, text), public.my_sessions() to authenticated;
