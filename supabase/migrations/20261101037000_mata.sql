-- F5-01 Mata: zona kamera per usaha dan kejadian status zona. Model berjalan di perangkat pemilik/admin; database hanya menerima
-- perubahan status (zona, status meja atau jumlah antrean), tidak pernah gambar atau video. ID dan varian model diisi di
-- public.konfigurasi kunci model_mata lewat SQL terpisah (tidak ditulis di repo). Rancangan: docs/research/mata.md.
-- Tes: supabase/tests/mata.test.sql.

create table public.zona_mata (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (char_length(btrim(nama)) between 1 and 60),
  jenis text not null check (jenis in ('meja', 'antrean', 'rak')),
  poligon jsonb not null,
  urutan int not null default 0,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create index on public.zona_mata (perusahaan_id) where aktif;
alter table public.zona_mata enable row level security;
create policy zona_mata_baca on public.zona_mata for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.zona_mata to authenticated;

create or replace function app.wajib_mata() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang memakai Mata' using errcode = '42501';
  end if;
  return v_pid;
end $$;

-- Poligon sah: larik 3..20 titik [x, y] dengan 0 <= x, y <= 1.
create or replace function app.poligon_sah(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 3 and 20
     and not exists (select 1 from jsonb_array_elements(p) t
                      where jsonb_typeof(t) <> 'array' or jsonb_array_length(t) <> 2
                         or jsonb_typeof(t -> 0) <> 'number' or jsonb_typeof(t -> 1) <> 'number'
                         or (t ->> 0)::numeric not between 0 and 1 or (t ->> 1)::numeric not between 0 and 1)
$$;

-- Simpan seluruh daftar zona usaha: zona berid diperbarui, tanpa id dibuat, zona yang tidak ada di daftar dinonaktifkan.
create or replace function public.simpan_zona_mata(p_zona jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata(); z jsonb; i int := 0; v_id uuid; v_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_zona) <> 'array' or jsonb_array_length(p_zona) > 40 then
    raise exception 'Daftar zona paling banyak 40.' using errcode = '22023';
  end if;
  for z in select * from jsonb_array_elements(p_zona) loop
    i := i + 1;
    if char_length(btrim(coalesce(z ->> 'nama', ''))) not between 1 and 60 then
      raise exception 'Nama zona wajib diisi, paling panjang 60 huruf.' using errcode = '22023';
    end if;
    if coalesce(z ->> 'jenis', '') not in ('meja', 'antrean', 'rak') then
      raise exception 'Jenis zona harus meja, antrean, atau rak.' using errcode = '22023';
    end if;
    if not app.poligon_sah(z -> 'poligon') then
      raise exception 'Zona harus berupa 3 sampai 20 titik di dalam gambar.' using errcode = '22023';
    end if;
    v_id := nullif(z ->> 'id', '')::uuid;
    if v_id is not null then
      update public.zona_mata set nama = btrim(z ->> 'nama'), jenis = z ->> 'jenis', poligon = z -> 'poligon', urutan = i, aktif = true, diubah_at = now()
       where id = v_id and perusahaan_id = v_pid;
      if not found then raise exception 'Zona tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
    else
      insert into public.zona_mata (perusahaan_id, nama, jenis, poligon, urutan)
      values (v_pid, btrim(z ->> 'nama'), z ->> 'jenis', z -> 'poligon', i) returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;
  update public.zona_mata set aktif = false, diubah_at = now() where perusahaan_id = v_pid and aktif and not (id = any(v_ids));
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nama', nama, 'jenis', jenis, 'poligon', poligon) order by urutan)
                     from public.zona_mata where perusahaan_id = v_pid and aktif), '[]'::jsonb);
end $$;

-- Catat perubahan status zona. Butir: {zona, status (meja: kosong|terisi) atau jumlah (antrean/rak: 0..500), terjadi_at?}.
-- Hanya dicatat bila berbeda dari kejadian terakhir zona itu; waktu dijepit ke 10 menit terakhir; maks 50 butir sekali panggil.
create or replace function public.catat_mata(p_butir jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata(); b jsonb; zm public.zona_mata; v_jenis text; v_akhir public.kejadian; v_waktu timestamptz; n int := 0;
  v_status text; v_jumlah int;
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
    values (v_pid, v_waktu, v_jenis, 'mata', v_jumlah, jsonb_strip_nulls(jsonb_build_object('zona', zm.id, 'nama', zm.nama, 'status', v_status, 'jumlah', v_jumlah)));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Keadaan terakhir per zona aktif (dipakai layar Mata dan Peta Usaha).
create or replace function public.mata_keadaan() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon,
            'status', k.data ->> 'status', 'jumlah', (k.data ->> 'jumlah')::int, 'sejak', k.terjadi_at) order by z.urutan)
    from public.zona_mata z
    left join lateral (select data, terjadi_at from public.kejadian
                        where perusahaan_id = v_pid and jenis in ('mata.meja', 'mata.antrean') and data ->> 'zona' = z.id::text
                        order by terjadi_at desc, id desc limit 1) k on true
   where z.perusahaan_id = v_pid and z.aktif), '[]'::jsonb);
end $$;

revoke all on function app.wajib_mata(), app.poligon_sah(jsonb) from public, anon, authenticated;
revoke all on function public.simpan_zona_mata(jsonb), public.catat_mata(jsonb), public.mata_keadaan() from public, anon;
grant execute on function public.simpan_zona_mata(jsonb), public.catat_mata(jsonb), public.mata_keadaan() to authenticated;
