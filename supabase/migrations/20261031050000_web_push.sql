-- Web Push: langganan per perangkat (milik pengguna, dalam perusahaan aktif) dan kunci VAPID di Vault.
-- Kunci VAPID dibuat oleh Edge Function `push` saat pertama dipakai; rahasianya hanya hidup di Vault, bagian publiknya di app.vapid.
create table public.langganan_push (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null default app.pid() references public.perusahaan(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  perangkat text,
  dibuat timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index on public.langganan_push (perusahaan_id);

alter table public.langganan_push enable row level security;
create policy langganan_push_milik on public.langganan_push for all to authenticated
  using (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()))
  with check (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
grant select, insert, update, delete on public.langganan_push to authenticated;

create table app.vapid (
  id boolean primary key default true check (id),
  publik text not null,
  rahasia_id uuid not null,
  dibuat timestamptz not null default now()
);
revoke all on app.vapid from public, anon, authenticated;

-- Kunci publik (application server key) untuk pushManager.subscribe; aman dibaca siapa pun yang masuk.
create or replace function public.kunci_push_publik() returns text
language sql stable security definer set search_path = '' as $$
  select publik from app.vapid where id;
$$;
revoke all on function public.kunci_push_publik() from public, anon;
grant execute on function public.kunci_push_publik() to authenticated;

-- Hanya untuk Edge Function (peran service_role): simpan sekali, ambil JWK.
create or replace function public.vapid_simpan(p_publik text, p_jwk text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if exists (select 1 from app.vapid) then return false; end if;
  v_id := vault.create_secret(p_jwk, 'nadi_vapid_jwk', 'Kunci VAPID Web Push (JWK pasangan ECDSA P-256)');
  insert into app.vapid (publik, rahasia_id) values (p_publik, v_id);
  return true;
exception when unique_violation then
  return false; -- panggilan pertama yang bersamaan: yang kalah mundur, Vault ikut batal
end $$;

create or replace function public.vapid_ambil() returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from app.vapid v join vault.decrypted_secrets s on s.id = v.rahasia_id where v.id;
$$;
revoke all on function public.vapid_simpan(text, text), public.vapid_ambil() from public, anon, authenticated;
grant execute on function public.vapid_simpan(text, text), public.vapid_ambil() to service_role;
