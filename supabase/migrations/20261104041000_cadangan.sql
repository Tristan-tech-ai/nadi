-- Q-03B (docs/research/cadangan.md): cadangan mingguan data usaha ke bucket pribadi `cadangan` lewat Edge Function `cadangan`.
-- Ekspor dan uji pulih hanya untuk service_role (kunci bawaan runtime Edge Function); tidak ada pengguna yang bisa membaca bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cadangan', 'cadangan', false, 52428800, array['application/json'])
on conflict (id) do nothing;

create table if not exists app.cadangan_log (
  id uuid primary key default app.uuid7(),
  dibuat_at timestamptz not null default now(),
  jenis text not null check (jenis in ('cadangan', 'pulih', 'rotasi')),
  folder text not null,
  tabel integer not null default 0,
  baris bigint not null default 0,
  byte bigint not null default 0,
  rincian jsonb not null default '{}'::jsonb,
  galat text
);
revoke all on app.cadangan_log from public, anon, authenticated;

-- Tabel yang dicadangkan: semua tabel dasar public ber-perusahaan_id + perusahaan, kecuali kredensial, log, dan turunan.
create or replace function public.cadangan_daftar() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.relname::text order by t.relname), '{}')
    from pg_class t join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public' and t.relkind in ('r', 'p') and not t.relispartition
     and (t.relname = 'perusahaan' or exists (
       select 1 from pg_attribute a where a.attrelid = t.oid and a.attname = 'perusahaan_id' and not a.attisdropped))
     and t.relname not in ('mcp_token', 'oauth_kode', 'oauth_klien', 'langganan_push', 'kejadian', 'audit_log', 'ringkasan_harian', 'pemakaian_ai')
$$;

-- Isi satu tabel sebagai larik JSON, tanpa kolom penanda akses (token_status, token_hash, kode_hash).
create or replace function public.cadangan_tabel(p_tabel text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not (p_tabel = any(public.cadangan_daftar())) then
    raise exception 'Tabel % tidak termasuk cadangan', p_tabel using errcode = '22023';
  end if;
  execute format($q$select coalesce(jsonb_agg(to_jsonb(t) - array['token_status', 'token_hash', 'kode_hash']), '[]'::jsonb) from public.%I t$q$, p_tabel)
    into v;
  return v;
end $$;

-- Uji pulih tanpa mengubah data: muat isi berkas ke tabel sementara berbentuk tabel asli, hitung baris dan id unik.
create or replace function public.cadangan_uji_pulih(p_tabel text, p_isi jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n bigint; u bigint; ada_id boolean;
begin
  if not (p_tabel = any(public.cadangan_daftar())) then
    raise exception 'Tabel % tidak termasuk cadangan', p_tabel using errcode = '22023';
  end if;
  if jsonb_typeof(p_isi) <> 'array' then raise exception 'Isi cadangan harus larik' using errcode = '22023'; end if;
  execute format('create temp table pulih_uji on commit drop as select * from jsonb_populate_recordset(null::public.%I, $1)', p_tabel) using p_isi;
  select exists (select 1 from pg_attribute where attrelid = 'pg_temp.pulih_uji'::regclass and attname = 'id' and not attisdropped) into ada_id;
  execute 'select count(*) from pg_temp.pulih_uji' into n;
  if ada_id then execute 'select count(distinct id) from pg_temp.pulih_uji' into u; else u := n; end if;
  return jsonb_build_object('tabel', p_tabel, 'baris', n, 'unik', u, 'cocok', n = jsonb_array_length(p_isi) and u = n);
end $$;

create or replace function public.cadangan_catat(p_jenis text, p_folder text, p_tabel integer, p_baris bigint, p_byte bigint, p_rincian jsonb, p_galat text)
returns uuid language sql security definer set search_path = '' as $$
  insert into app.cadangan_log (jenis, folder, tabel, baris, byte, rincian, galat)
  values (p_jenis, p_folder, p_tabel, p_baris, p_byte, coalesce(p_rincian, '{}'::jsonb), p_galat) returning id
$$;

revoke all on function public.cadangan_daftar() from public, anon, authenticated;
revoke all on function public.cadangan_tabel(text) from public, anon, authenticated;
revoke all on function public.cadangan_uji_pulih(text, jsonb) from public, anon, authenticated;
revoke all on function public.cadangan_catat(text, text, integer, bigint, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.cadangan_daftar() to service_role;
grant execute on function public.cadangan_tabel(text) to service_role;
grant execute on function public.cadangan_uji_pulih(text, jsonb) to service_role;
grant execute on function public.cadangan_catat(text, text, integer, bigint, bigint, jsonb, text) to service_role;

-- Pemicu mingguan: token Vault yang sama dengan push (dicocokkan push_token_cocok di Edge Function).
create or replace function app.kirim_cadangan(p_aksi text default 'cadangan') returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if p_aksi not in ('cadangan', 'uji_pulih') then raise exception 'Aksi tidak dikenal' using errcode = '22023'; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'nadi_push_token';
  return net.http_post(
    url := 'https://izyesrryiljitpusaqvf.supabase.co/functions/v1/cadangan',
    body := jsonb_build_object('aksi', p_aksi),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nadi-token', v_token),
    timeout_milliseconds := 120000);
end $$;
revoke all on function app.kirim_cadangan(text) from public, anon, authenticated;

select cron.schedule('nadi-cadangan', '30 18 * * 0', $$select app.kirim_cadangan('cadangan')$$);
