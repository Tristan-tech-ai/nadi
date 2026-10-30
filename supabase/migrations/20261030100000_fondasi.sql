-- see repo file supabase/migrations/20261030100000_fondasi.sql
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gin with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists ltree with schema extensions;
create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pgmq;
create schema if not exists partman;
create extension if not exists pg_partman with schema partman;

create schema if not exists app;
grant usage on schema app to authenticated, anon;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;

create or replace function app.uuid7() returns uuid
language sql volatile set search_path = '' as $$
  select encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
        placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
        from 1 for 6),
      52, 1), 53, 1),
    'hex')::uuid;
$$;

create or replace function app.pid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'pid', '')::uuid;
$$;

create or replace function app.prn() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'prn', '');
$$;

create or replace function app.pengelola() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'prn', '') in ('pemilik', 'admin');
$$;

create or replace function app.set_diubah() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.diubah_at := now();
  return new;
end $$;

create table public.perusahaan (
  id uuid primary key default app.uuid7(),
  nama text not null check (length(nama) between 2 and 120),
  bentuk_usaha text,
  industri text,
  zona_waktu text not null default 'Asia/Jakarta',
  pengaturan jsonb not null default '{}'::jsonb,
  dibuat_oleh uuid references auth.users(id) on delete set null,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create trigger perusahaan_diubah before update on public.perusahaan for each row execute function app.set_diubah();
create index on public.perusahaan (dibuat_oleh);

create table public.anggota (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  peran text not null default 'staf' check (peran in ('pemilik', 'admin', 'akuntan', 'staf')),
  orang_id uuid,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  primary key (perusahaan_id, user_id)
);
create index on public.anggota (user_id);

alter table public.perusahaan enable row level security;
alter table public.anggota enable row level security;
alter table public.perusahaan force row level security;
alter table public.anggota force row level security;

create policy perusahaan_baca on public.perusahaan for select to authenticated
  using (id in (select a.perusahaan_id from public.anggota a where a.user_id = (select auth.uid()) and a.aktif));
create policy perusahaan_ubah on public.perusahaan for update to authenticated
  using (id = (select app.pid()) and (select app.prn()) = 'pemilik')
  with check (id = (select app.pid()));

create policy anggota_baca on public.anggota for select to authenticated
  using (user_id = (select auth.uid()) or perusahaan_id = (select app.pid()));
create policy anggota_kelola on public.anggota for update to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()))
  with check (perusahaan_id = (select app.pid()) and peran <> 'pemilik');

create or replace function app.tulis_klaim(p_user uuid, p_pid uuid, p_prn text) returns void
language sql security definer set search_path = '' as $$
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('pid', p_pid, 'prn', p_prn)
   where id = p_user;
$$;
revoke all on function app.tulis_klaim(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.pindah_perusahaan(p_perusahaan uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_peran text;
begin
  select peran into v_peran from public.anggota
   where perusahaan_id = p_perusahaan and user_id = auth.uid() and aktif;
  if v_peran is null then
    raise exception 'Kamu bukan anggota perusahaan ini' using errcode = '42501';
  end if;
  perform app.tulis_klaim(auth.uid(), p_perusahaan, v_peran);
  return v_peran;
end $$;
revoke all on function public.pindah_perusahaan(uuid) from public, anon;
grant execute on function public.pindah_perusahaan(uuid) to authenticated;

create or replace function public.buat_perusahaan(p_nama text, p_industri text default null, p_bentuk text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Belum masuk' using errcode = '42501'; end if;
  if (select count(*) from public.perusahaan where dibuat_oleh = auth.uid()) >= 20 then
    raise exception 'Batas 20 perusahaan per akun' using errcode = '54000';
  end if;
  insert into public.perusahaan (nama, industri, bentuk_usaha, dibuat_oleh)
  values (trim(p_nama), p_industri, p_bentuk, auth.uid()) returning id into v_id;
  insert into public.anggota (perusahaan_id, user_id, peran) values (v_id, auth.uid(), 'pemilik');
  perform app.tulis_klaim(auth.uid(), v_id, 'pemilik');
  return v_id;
end $$;
revoke all on function public.buat_perusahaan(text, text, text) from public, anon;
grant execute on function public.buat_perusahaan(text, text, text) to authenticated;

create or replace function app.sinkron_klaim_anggota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select raw_app_meta_data ->> 'pid' from auth.users where id = new.user_id) = new.perusahaan_id::text then
    if new.aktif then
      perform app.tulis_klaim(new.user_id, new.perusahaan_id, new.peran);
    else
      update auth.users set raw_app_meta_data = raw_app_meta_data - 'pid' - 'prn' where id = new.user_id;
    end if;
  end if;
  return new;
end $$;
create trigger anggota_sinkron_klaim after update of peran, aktif on public.anggota
  for each row execute function app.sinkron_klaim_anggota();

create or replace function app.anggota_aktif(p_peran text[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.anggota
     where perusahaan_id = app.pid() and user_id = auth.uid() and aktif
       and (p_peran is null or peran = any(p_peran)));
$$;

grant execute on function app.pid(), app.prn(), app.pengelola(), app.uuid7(), app.anggota_aktif(text[]) to authenticated;
grant select on public.perusahaan, public.anggota to authenticated;
grant update (nama, bentuk_usaha, industri, zona_waktu, pengaturan) on public.perusahaan to authenticated;
grant update (peran, aktif, orang_id) on public.anggota to authenticated;
