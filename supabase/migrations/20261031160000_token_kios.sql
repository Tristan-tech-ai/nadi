-- Token kios (F1-02B): tablet di pintu masuk menampilkan QR absen tanpa masuk sebagai pemilik. Token buram `nmk_` (hanya sha256
-- disimpan) terikat ke satu tempat; satu-satunya yang bisa dilakukan token adalah meminta kode absen saat ini. Bisa dicabut.

create table app.token_kios (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tempat_id uuid not null references public.tempat(id) on delete cascade,
  hash text not null unique,
  nama text not null default 'Tablet',
  dibuat_oleh uuid not null,
  dibuat_at timestamptz not null default now(),
  dipakai_at timestamptz,
  dicabut_at timestamptz
);
create index on app.token_kios (perusahaan_id) where dicabut_at is null;
revoke all on app.token_kios from public, anon, authenticated;

-- Pemilik/admin membuat token untuk tempat utama. Token mentah hanya dikembalikan sekali.
create or replace function public.buat_token_kios(p_nama text default 'Tablet') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_tempat uuid; v_token text := app.token_baru('nmk_'); v_id uuid;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  v_tempat := public.tempat_absen_utama();
  insert into app.token_kios (perusahaan_id, tempat_id, hash, nama, dibuat_oleh)
  values (v_pid, v_tempat, app.hash_token(v_token), left(coalesce(nullif(btrim(p_nama), ''), 'Tablet'), 40), (select auth.uid()))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

-- Daftar tablet aktif usaha yang dibuka (tanpa hash).
create or replace function public.daftar_token_kios() returns table (id uuid, nama text, dibuat_at timestamptz, dipakai_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  return query select k.id, k.nama, k.dibuat_at, k.dipakai_at from app.token_kios k
    where k.perusahaan_id = app.pid() and k.dicabut_at is null order by k.dibuat_at desc;
end $$;

create or replace function public.cabut_token_kios(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if app.pid() is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  update app.token_kios set dicabut_at = now() where id = p_id and perusahaan_id = app.pid() and dicabut_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Dipanggil tablet tanpa akun: token sah dan belum dicabut -> kode sekarang. Galat sama untuk token salah dan dicabut.
create or replace function public.kode_absen_kios(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; r bytea; u double precision := extract(epoch from clock_timestamp());
begin
  select t.id, t.tempat_id, t.dipakai_at into k from app.token_kios t join public.tempat tp on tp.id = t.tempat_id
   where t.hash = app.hash_token(coalesce(p_token, '')) and t.dicabut_at is null and tp.aktif;
  if k.id is null then raise exception 'Tautan tablet ini tidak berlaku lagi. Minta pemilik membuat tautan baru.' using errcode = '28000'; end if;
  select rahasia into r from app.rahasia_tempat where tempat_id = k.tempat_id;
  if r is null then raise exception 'Tempat tidak ditemukan' using errcode = 'P0002'; end if;
  if k.dipakai_at is null or k.dipakai_at < now() - interval '5 minutes' then update app.token_kios set dipakai_at = now() where id = k.id; end if;
  return jsonb_build_object('tempat', k.tempat_id, 'kode', app.totp(r, u, 15, 6), 'sisa_detik', ceil(15 - mod(u::numeric, 15))::int);
end $$;

revoke all on function public.buat_token_kios(text), public.daftar_token_kios(), public.cabut_token_kios(uuid), public.kode_absen_kios(text) from public, anon;
grant execute on function public.buat_token_kios(text), public.daftar_token_kios(), public.cabut_token_kios(uuid) to authenticated;
grant execute on function public.kode_absen_kios(text) to anon, authenticated;
