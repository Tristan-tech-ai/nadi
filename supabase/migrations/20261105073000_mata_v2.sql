-- W-02 Mata v2: kunjungan, lama kunjungan, tunggu antrean, layanan kasir, peta panas per zona per jam, dan jalur anonim.
-- Kamera atas diproses di perangkat (src/lib/mata/jejak.ts: beda latar + pelacak posisi). Database hanya menerima REKAP per
-- jam: jumlah dan detik, tanpa nomor jejak, tanpa waktu per orang, tanpa gambar. Jalur yang dilalui kurang dari 3 kunjungan
-- dalam rentang yang diminta tidak ditampilkan. UU 27/2022 Pasal 17 ayat (1): papan informasi wajib di area kamera (huruf b),
-- tidak untuk mengidentifikasi orang (huruf c); pencatatan ditolak sebelum pemilik/admin menyatakan papan terpasang.
-- Rancangan: docs/research/mata-v2.md. Tes: supabase/tests/mata_v2.test.sql.

-- 1. Jenis zona baru: kasir (dilayani), pintu (masuk/keluar), lorong, kerja (pos karyawan, tidak dihitung kunjungan).
alter table public.zona_mata drop constraint zona_mata_jenis_check;
alter table public.zona_mata add constraint zona_mata_jenis_check check (jenis in ('meja', 'antrean', 'rak', 'kasir', 'pintu', 'lorong', 'kerja'));

create or replace function public.save_vision_zones(p_zones jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_pid uuid := app.wajib_mata(); z jsonb; i int := 0; v_id uuid; v_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) > 40 then
    raise exception 'Daftar zona paling banyak 40.' using errcode = '22023';
  end if;
  for z in select * from jsonb_array_elements(p_zones) loop
    i := i + 1;
    if char_length(btrim(coalesce(z ->> 'nama', ''))) not between 1 and 60 then
      raise exception 'Nama zona wajib diisi, paling panjang 60 huruf.' using errcode = '22023';
    end if;
    if coalesce(z ->> 'jenis', '') not in ('meja', 'antrean', 'rak', 'kasir', 'pintu', 'lorong', 'kerja') then
      raise exception 'Jenis zona harus meja, antrean, rak, kasir, pintu, lorong, atau pos kerja.' using errcode = '22023';
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
end $function$;

-- 2. Rekap per jam (nama teknis Inggris, I-04). Hanya dibaca pemilik/admin; ditulis lewat record_vision_visits.
create table public.vision_hourly (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  hour timestamptz not null check (date_trunc('hour', hour) = hour),
  visits int not null default 0 check (visits >= 0),
  dwell_seconds bigint not null default 0 check (dwell_seconds >= 0),
  waited int not null default 0 check (waited >= 0),
  wait_seconds bigint not null default 0 check (wait_seconds >= 0),
  served int not null default 0 check (served >= 0),
  service_seconds bigint not null default 0 check (service_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (perusahaan_id, hour)
);
create table public.vision_hourly_zone (
  perusahaan_id uuid not null,
  hour timestamptz not null,
  zone_id uuid not null references public.zona_mata(id) on delete cascade,
  visits int not null default 0 check (visits >= 0),
  seconds bigint not null default 0 check (seconds >= 0),
  primary key (perusahaan_id, hour, zone_id),
  foreign key (perusahaan_id, hour) references public.vision_hourly (perusahaan_id, hour) on delete cascade
);
create index on public.vision_hourly_zone (zone_id);
create table public.vision_hourly_path (
  perusahaan_id uuid not null,
  hour timestamptz not null,
  path text not null check (char_length(path) between 1 and 400),
  visits int not null default 0 check (visits >= 0),
  primary key (perusahaan_id, hour, path),
  foreign key (perusahaan_id, hour) references public.vision_hourly (perusahaan_id, hour) on delete cascade
);
alter table public.vision_hourly enable row level security;
alter table public.vision_hourly_zone enable row level security;
alter table public.vision_hourly_path enable row level security;
create policy vision_hourly_baca on public.vision_hourly for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy vision_hourly_zone_baca on public.vision_hourly_zone for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy vision_hourly_path_baca on public.vision_hourly_path for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.vision_hourly, public.vision_hourly_zone, public.vision_hourly_path to authenticated;

-- Kunci kiriman: satu rekap dari perangkat hanya dijumlahkan sekali walau dikirim ulang (jaringan putus).
create table app.vision_batch (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (perusahaan_id, key)
);
alter table app.vision_batch enable row level security;

-- 3. Papan informasi (Pasal 17 ayat (1) huruf b): pemilik/admin menyatakan papan terpasang; dicatat waktu dan siapa.
create or replace function public.set_vision_notice(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata(); v jsonb;
begin
  v := case when p_on then jsonb_build_object('at', now(), 'by', auth.uid()) else null end;
  update public.perusahaan set pengaturan = case when v is null then pengaturan - 'mata_papan' else jsonb_set(pengaturan, '{mata_papan}', v) end
   where id = v_pid;
  return v;
end $$;

-- 4. Catat rekap per jam dari perangkat. p_hours: larik {jam, kunjungan, lamaDetik, tungguN, tungguDetik, layanN, layanDetik,
--    zona: {id: {lintas, detik}}, jalur: {teks: n}} (bentuk RekapJam di src/lib/mata/jejak.ts). Nilai dijumlahkan ke jam itu.
create or replace function public.record_vision_visits(p_hours jsonb, p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata(); h jsonb; v_jam timestamptz; v_n int; v_lama bigint; v_tn int; v_td bigint; v_ln int; v_ld bigint;
  z record; j record; v_zl int; v_zd bigint; n int := 0;
begin
  if (select pengaturan -> 'mata_papan' from public.perusahaan where id = v_pid) is null then
    raise exception 'Pasang papan informasi kamera dulu (UU 27/2022 Pasal 17), lalu centang di layar Mata.' using errcode = '55000';
  end if;
  if p_key is null or char_length(p_key) not between 8 and 80 then
    raise exception 'Kunci kiriman 8 sampai 80 huruf.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) not between 1 and 48 then
    raise exception 'Rekap 1 sampai 48 jam sekali kirim.' using errcode = '22023';
  end if;
  if (select count(*) from app.vision_batch where perusahaan_id = v_pid and created_at > now() - interval '1 day') >= 2000 then
    raise exception 'Kiriman rekap Mata hari ini sudah 2.000. Coba lagi besok.' using errcode = '54000';
  end if;
  insert into app.vision_batch (perusahaan_id, key) values (v_pid, p_key) on conflict do nothing;
  if not found then return jsonb_build_object('sudah', true, 'jam', 0); end if;
  for h in select * from jsonb_array_elements(p_hours) loop
    begin
      v_jam := (h ->> 'jam')::timestamptz;
      v_n := (h ->> 'kunjungan')::int; v_lama := (h ->> 'lamaDetik')::bigint;
      v_tn := coalesce((h ->> 'tungguN')::int, 0); v_td := coalesce((h ->> 'tungguDetik')::bigint, 0);
      v_ln := coalesce((h ->> 'layanN')::int, 0); v_ld := coalesce((h ->> 'layanDetik')::bigint, 0);
    exception when others then
      raise exception 'Isi rekap tidak terbaca (jam dan angka).' using errcode = '22023';
    end;
    if v_jam is null or date_trunc('hour', v_jam) <> v_jam or v_jam > now() or v_jam < now() - interval '7 days' then
      raise exception 'Jam rekap harus awal jam, tidak di masa depan, paling lama 7 hari lalu.' using errcode = '22023';
    end if;
    if v_n is null or v_n not between 0 and 5000 or v_lama is null or v_lama < 0 or v_lama > v_n::bigint * 86400
       or v_tn not between 0 and v_n or v_ln not between 0 and v_n or v_td < 0 or v_td > v_lama or v_ld < 0 or v_ld > v_lama then
      raise exception 'Angka rekap di luar batas wajar.' using errcode = '22023';
    end if;
    insert into public.vision_hourly as t (perusahaan_id, hour, visits, dwell_seconds, waited, wait_seconds, served, service_seconds)
    values (v_pid, v_jam, v_n, v_lama, v_tn, v_td, v_ln, v_ld)
    on conflict (perusahaan_id, hour) do update set visits = t.visits + excluded.visits, dwell_seconds = t.dwell_seconds + excluded.dwell_seconds,
      waited = t.waited + excluded.waited, wait_seconds = t.wait_seconds + excluded.wait_seconds, served = t.served + excluded.served,
      service_seconds = t.service_seconds + excluded.service_seconds, updated_at = now();
    if jsonb_typeof(coalesce(h -> 'zona', '{}')) <> 'object' or (select count(*) from jsonb_object_keys(coalesce(h -> 'zona', '{}'))) > 40 then
      raise exception 'Rekap zona paling banyak 40.' using errcode = '22023';
    end if;
    for z in select key, value from jsonb_each(coalesce(h -> 'zona', '{}')) loop
      if not exists (select 1 from public.zona_mata where id = app.uuid_aman(z.key) and perusahaan_id = v_pid) then
        raise exception 'Zona tidak ditemukan di usahamu.' using errcode = 'P0002';
      end if;
      v_zl := (z.value ->> 'lintas')::int; v_zd := (z.value ->> 'detik')::bigint;
      if v_zl is null or v_zl not between 0 and v_n or v_zd is null or v_zd < 0 or v_zd > v_lama then
        raise exception 'Angka zona di luar batas wajar.' using errcode = '22023';
      end if;
      insert into public.vision_hourly_zone as t (perusahaan_id, hour, zone_id, visits, seconds) values (v_pid, v_jam, z.key::uuid, v_zl, v_zd)
      on conflict (perusahaan_id, hour, zone_id) do update set visits = t.visits + excluded.visits, seconds = t.seconds + excluded.seconds;
    end loop;
    if jsonb_typeof(coalesce(h -> 'jalur', '{}')) <> 'object' or (select count(*) from jsonb_object_keys(coalesce(h -> 'jalur', '{}'))) > 50 then
      raise exception 'Rekap jalur paling banyak 50.' using errcode = '22023';
    end if;
    for j in select key, value from jsonb_each_text(coalesce(h -> 'jalur', '{}')) loop
      if char_length(j.key) not between 1 and 400 or j.value !~ '^\d{1,5}$' or j.value::int > v_n then
        raise exception 'Jalur rekap tidak wajar.' using errcode = '22023';
      end if;
      insert into public.vision_hourly_path as t (perusahaan_id, hour, path, visits) values (v_pid, v_jam, j.key, j.value::int)
      on conflict (perusahaan_id, hour, path) do update set visits = t.visits + excluded.visits;
    end loop;
    n := n + 1;
  end loop;
  return jsonb_build_object('sudah', false, 'jam', n);
end $$;

-- uuid dari teks tanpa melempar galat (kunci zona dari perangkat).
create or replace function app.uuid_aman(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- 5. Peta panas: rentang tanggal (zona usaha, paling banyak 31 hari). Jalur dengan kurang dari 3 kunjungan disembunyikan.
create or replace function public.vision_heatmap(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_mata(); v_tz text := app.zona(app.pid()); v_a timestamptz; v_b timestamptz; v_ringkas jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception 'Rentang 1 sampai 31 hari.' using errcode = '22023';
  end if;
  v_a := p_from::timestamp at time zone v_tz;
  v_b := (p_to + 1)::timestamp at time zone v_tz;
  select jsonb_build_object('kunjungan', coalesce(sum(visits), 0), 'lamaDetik', coalesce(sum(dwell_seconds), 0),
           'tungguN', coalesce(sum(waited), 0), 'tungguDetik', coalesce(sum(wait_seconds), 0),
           'layanN', coalesce(sum(served), 0), 'layanDetik', coalesce(sum(service_seconds), 0))
    into v_ringkas from public.vision_hourly where perusahaan_id = v_pid and hour >= v_a and hour < v_b;
  return v_ringkas || jsonb_build_object(
    'zona', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nama', z.nama, 'jenis', z.jenis, 'poligon', z.poligon,
              'lintas', coalesce(s.visits, 0), 'detik', coalesce(s.seconds, 0)) order by z.urutan)
            from public.zona_mata z
            left join (select zone_id, sum(visits) visits, sum(seconds) seconds from public.vision_hourly_zone
                        where perusahaan_id = v_pid and hour >= v_a and hour < v_b group by zone_id) s on s.zone_id = z.id
           where z.perusahaan_id = v_pid and z.aktif), '[]'::jsonb),
    'jam', coalesce((select jsonb_agg(jsonb_build_object('jam', j, 'kunjungan', n) order by j)
            from (select extract(hour from hour at time zone v_tz)::int j, sum(visits) n from public.vision_hourly
                   where perusahaan_id = v_pid and hour >= v_a and hour < v_b group by 1) x), '[]'::jsonb),
    'jalur', coalesce((select jsonb_agg(jsonb_build_object('jalur', path, 'kunjungan', n) order by n desc, path)
            from (select path, sum(visits) n from public.vision_hourly_path
                   where perusahaan_id = v_pid and hour >= v_a and hour < v_b group by path having sum(visits) >= 3
                   order by 2 desc, 1 limit 5) x), '[]'::jsonb),
    'papan', (select pengaturan -> 'mata_papan' from public.perusahaan where id = v_pid));
end $$;

revoke all on function app.uuid_aman(text) from public, anon, authenticated;
revoke all on function public.set_vision_notice(boolean), public.record_vision_visits(jsonb, text), public.vision_heatmap(date, date) from public, anon;
grant execute on function public.set_vision_notice(boolean), public.record_vision_visits(jsonb, text), public.vision_heatmap(date, date) to authenticated;
