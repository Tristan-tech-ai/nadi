-- F5-04 (docs/edge/PASANG.md): token terbatas untuk agen edge Mata (kotak lokal yang membaca kamera RTSP). Token nma_ hanya
-- disimpan sebagai sha256 (app.hash_token), terikat satu usaha, bisa dicabut; satu-satunya kemampuannya membaca zona aktif
-- usaha itu dan mencatat keadaan zona lewat logika yang sama dengan catat_mata (kejadian hanya saat berubah, waktu dijepit
-- 10 menit, paling banyak 50 butir). Bukan service-role: agen memakai kunci publik Supabase + token ini. Tes:
-- supabase/tests/agen_mata.test.sql.

create table public.agen_mata (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 2 and 60),
  token_hash text not null unique,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  terakhir_at timestamptz,
  dicabut_at timestamptz
);
create index on public.agen_mata (perusahaan_id);
alter table public.agen_mata enable row level security;
create policy agen_mata_baca on public.agen_mata for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select (id, perusahaan_id, nama, dibuat_at, terakhir_at, dicabut_at) on public.agen_mata to authenticated;
create trigger audit_agen_mata after insert or update or delete on public.agen_mata for each row execute function app.catat_audit();

create or replace function public.buat_token_agen_mata(p_nama text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_token text := app.token_baru('nma_');
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membuat token agen Mata.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 60 then raise exception 'Beri nama agen, 2 sampai 60 huruf.' using errcode = '22023'; end if;
  insert into public.agen_mata (perusahaan_id, nama, token_hash, dibuat_oleh) values (v_pid, btrim(p_nama), app.hash_token(v_token), auth.uid());
  return v_token;
end $$;

create or replace function public.cabut_token_agen_mata(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencabut token agen Mata.' using errcode = '42501';
  end if;
  update public.agen_mata set dicabut_at = now() where id = p_id and perusahaan_id = v_pid and dicabut_at is null;
  if not found then raise exception 'Token agen tidak ditemukan atau sudah dicabut.' using errcode = 'P0002'; end if;
end $$;

-- Usaha pemilik token yang masih berlaku; mencatat terakhir dipakai.
create or replace function app.usaha_agen_mata(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid;
begin
  update public.agen_mata set terakhir_at = now()
   where token_hash = app.hash_token(coalesce(p_token, '')) and dicabut_at is null returning perusahaan_id into v_pid;
  if v_pid is null then raise exception 'Token agen tidak berlaku.' using errcode = '28000'; end if;
  return v_pid;
end $$;
revoke all on function app.usaha_agen_mata(text) from public, anon, authenticated;

create or replace function public.agen_mata_zona(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.usaha_agen_mata(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon) order by z.urutan)
    from public.zona_mata z where z.perusahaan_id = v_pid and z.aktif), '[]'::jsonb);
end $$;

-- Sama dengan public.catat_mata (migrasi mata), dengan usaha dari token agen, bukan dari JWT.
create or replace function public.agen_mata_catat(p_token text, p_butir jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.usaha_agen_mata(p_token); b jsonb; zm public.zona_mata; v_jenis text; v_akhir public.kejadian; v_waktu timestamptz;
  n int := 0; v_status text; v_jumlah int;
begin
  if jsonb_typeof(p_butir) <> 'array' or jsonb_array_length(p_butir) > 50 then
    raise exception 'Paling banyak 50 butir sekali catat.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_butir) loop
    select * into zm from public.zona_mata where id = nullif(b ->> 'zona', '')::uuid and perusahaan_id = v_pid and aktif;
    if zm.id is null then raise exception 'Zona tidak ditemukan atau sudah tidak dipakai.' using errcode = 'P0002'; end if;
    v_jenis := case zm.jenis when 'meja' then 'mata.meja' else 'mata.antrean' end;
    v_status := null; v_jumlah := null;
    if zm.jenis = 'meja' then
      v_status := b ->> 'status';
      if v_status is null or v_status not in ('kosong', 'terisi') then raise exception 'Status meja harus kosong atau terisi.' using errcode = '22023'; end if;
    else
      v_jumlah := (b ->> 'jumlah')::int;
      if v_jumlah is null or v_jumlah not between 0 and 500 then raise exception 'Jumlah antrean 0 sampai 500.' using errcode = '22023'; end if;
    end if;
    select * into v_akhir from public.kejadian where perusahaan_id = v_pid and jenis = v_jenis and data ->> 'zona' = zm.id::text
     order by terjadi_at desc, id desc limit 1;
    if v_akhir.id is not null and ((zm.jenis = 'meja' and v_akhir.data ->> 'status' = v_status) or (zm.jenis <> 'meja' and v_akhir.nilai = v_jumlah)) then
      continue;
    end if;
    v_waktu := least(now(), greatest(now() - interval '10 minutes', coalesce((b ->> 'terjadi_at')::timestamptz, now())));
    insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
    values (v_pid, v_waktu, v_jenis, 'mata_agen', v_jumlah, jsonb_strip_nulls(jsonb_build_object('zona', zm.id, 'nama', zm.nama, 'status', v_status, 'jumlah', v_jumlah)));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.buat_token_agen_mata(text), public.cabut_token_agen_mata(uuid) from public, anon;
grant execute on function public.buat_token_agen_mata(text), public.cabut_token_agen_mata(uuid) to authenticated;
revoke all on function public.agen_mata_zona(text), public.agen_mata_catat(text, jsonb) from public;
grant execute on function public.agen_mata_zona(text), public.agen_mata_catat(text, jsonb) to anon, authenticated;
