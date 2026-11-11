-- X-10 kerja tim: satu kerja bisa dikerjakan beberapa orang dengan porsi 1-100% (jumlah 100) dan satu PIC; checklist satu
-- tingkat (butir) dengan progres yang bisa dicentang semua pelaksana (temuan uji X-08: pelaksana tidak bisa mencentang
-- checklist yang dibuat PIC). kerja.pelaksana_id tetap ada sebagai PIC supaya layar, klien MCP, dan fungsi lama tetap jalan;
-- kerja satu pelaksana = porsi 100%, jadi poin beban, KPI, dan kolam bonus kerja lama tidak berubah (diuji sebelum-sesudah).
-- Anggota yang keluar dari tim tidak dihapus: barisnya diberi lepas_at (riwayat tim tetap ada, pola batal bukan hapus).

create table public.kerja_pelaksana (
  kerja_id uuid not null references public.kerja(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id),
  porsi smallint not null check (porsi between 1 and 100),
  pic boolean not null default false,
  lepas_at timestamptz,
  dibuat_at timestamptz not null default now(),
  primary key (kerja_id, orang_id),
  check (not (pic and lepas_at is not null))
);
create unique index kerja_pelaksana_satu_pic on public.kerja_pelaksana (kerja_id) where pic;
create index kerja_pelaksana_orang on public.kerja_pelaksana (perusahaan_id, orang_id);

create table public.kerja_butir (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kerja_id uuid not null references public.kerja(id) on delete cascade,
  judul text not null check (char_length(judul) between 1 and 200),
  urutan integer not null default 0,
  selesai boolean not null default false,
  selesai_oleh uuid,
  selesai_at timestamptz,
  batal boolean not null default false,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);
create index kerja_butir_kerja on public.kerja_butir (kerja_id, urutan);

-- Pembagian porsi per kerja: baris kerja_pelaksana yang masih di tim, atau 100% untuk pelaksana_id lama tanpa baris (cadangan).
create function app.kerja_porsi(p_pid uuid) returns table (kerja_id uuid, orang_id uuid, porsi numeric, pic boolean)
language sql stable set search_path = '' as $$
  select kp.kerja_id, kp.orang_id, kp.porsi::numeric, kp.pic from public.kerja_pelaksana kp where kp.perusahaan_id = p_pid and kp.lepas_at is null
  union all
  select k.id, k.pelaksana_id, 100::numeric, true from public.kerja k
   where k.perusahaan_id = p_pid and k.pelaksana_id is not null
     and not exists (select 1 from public.kerja_pelaksana kp where kp.kerja_id = k.id and kp.lepas_at is null)
$$;

-- Kerja tempat orang sesi ini menjadi pelaksana (security definer: dipakai kebijakan RLS tanpa rekursi).
create function app.kerja_saya() returns setof uuid language sql stable security definer set search_path = '' as $$
  select kp.kerja_id from public.kerja_pelaksana kp where kp.perusahaan_id = app.pid() and kp.orang_id = app.orang_saya() and kp.lepas_at is null
$$;

-- Sinkron dari pelaksana_id (jalur lama: buat_kerja, papan, klien MCP): kerja tanpa tim atau satu pelaksana selalu satu baris
-- 100%; kerja bertim memindah tanda PIC bila PIC baru anggota tim, selain itu tim diganti satu pelaksana baru.
create function app.sinkron_pelaksana_kerja() returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if current_setting('app.atur_pelaksana', true) = '1' then return new; end if;
  if tg_op = 'UPDATE' and new.pelaksana_id is not distinct from old.pelaksana_id then return new; end if;
  select count(*) into n from public.kerja_pelaksana where kerja_id = new.id and lepas_at is null;
  if new.pelaksana_id is null then
    if n <= 1 then update public.kerja_pelaksana set lepas_at = now(), pic = false where kerja_id = new.id and lepas_at is null; end if;
  elsif n > 1 and exists (select 1 from public.kerja_pelaksana where kerja_id = new.id and orang_id = new.pelaksana_id and lepas_at is null) then
    update public.kerja_pelaksana set pic = false where kerja_id = new.id and pic;
    update public.kerja_pelaksana set pic = true where kerja_id = new.id and orang_id = new.pelaksana_id;
  else
    update public.kerja_pelaksana set lepas_at = now(), pic = false where kerja_id = new.id and lepas_at is null and orang_id <> new.pelaksana_id;
    insert into public.kerja_pelaksana (kerja_id, perusahaan_id, orang_id, porsi, pic) values (new.id, new.perusahaan_id, new.pelaksana_id, 100, true)
    on conflict (kerja_id, orang_id) do update set porsi = 100, pic = true, lepas_at = null;
  end if;
  return new;
end $$;
create trigger sinkron_pelaksana_kerja after insert or update of pelaksana_id on public.kerja
  for each row execute function app.sinkron_pelaksana_kerja();

insert into public.kerja_pelaksana (kerja_id, perusahaan_id, orang_id, porsi, pic)
select k.id, k.perusahaan_id, k.pelaksana_id, 100, true from public.kerja k where k.pelaksana_id is not null
on conflict do nothing;

-- RLS: baca saja untuk klien; tulis lewat RPC.
alter table public.kerja_pelaksana enable row level security;
alter table public.kerja_butir enable row level security;
create policy kerja_pelaksana_baca on public.kerja_pelaksana for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and kerja_id in (select app.kerja_saya()))));
create policy kerja_butir_baca on public.kerja_butir for select to authenticated using (perusahaan_id = (select app.pid())
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or ((select app.anggota_aktif()) and kerja_id in (select app.kerja_saya()))));
grant select on public.kerja_pelaksana, public.kerja_butir to authenticated;
-- Pelaksana bersama juga melihat kerjanya (dulu hanya pelaksana_id).
drop policy kerja_baca on public.kerja;
create policy kerja_baca on public.kerja for select to authenticated using ((perusahaan_id = (select app.pid()))
  and ((select app.anggota_aktif(array['pemilik', 'admin', 'akuntan'])) or (pelaksana_id = (select app.orang_saya()))
       or ((select app.anggota_aktif()) and id in (select app.kerja_saya()))));

create function public.atur_pelaksana_kerja(p_kerja uuid, p_daftar jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kerja; e jsonb; v_pic uuid; v_jumlah integer := 0; n integer;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Hanya pemilik atau admin yang bisa mengatur pelaksana.' using errcode = '42501'; end if;
  select * into k from public.kerja where id = p_kerja and perusahaan_id = v_pid for update;
  if k.id is null then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_daftar) <> 'array' or jsonb_array_length(p_daftar) not between 1 and 10 then
    raise exception 'Pelaksana 1 sampai 10 orang.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_daftar) loop
    if (e ->> 'orang_id') !~ '^[0-9a-f-]{36}$' or not exists (select 1 from public.orang o where o.id = (e ->> 'orang_id')::uuid and o.perusahaan_id = v_pid and o.status = 'aktif') then
      raise exception 'Pelaksana tidak ditemukan di usahamu.' using errcode = 'P0002';
    end if;
    if jsonb_typeof(e -> 'porsi') <> 'number' or (e ->> 'porsi')::numeric not between 1 and 100 or (e ->> 'porsi')::numeric <> round((e ->> 'porsi')::numeric) then
      raise exception 'Porsi tiap pelaksana 1 sampai 100 persen, bilangan bulat.' using errcode = '22023';
    end if;
    v_jumlah := v_jumlah + (e ->> 'porsi')::integer;
    if (e ->> 'pic')::boolean is true then
      if v_pic is not null then raise exception 'PIC hanya satu orang.' using errcode = '22023'; end if;
      v_pic := (e ->> 'orang_id')::uuid;
    end if;
  end loop;
  select count(distinct x ->> 'orang_id') into n from jsonb_array_elements(p_daftar) x;
  if n <> jsonb_array_length(p_daftar) then raise exception 'Satu orang hanya sekali di daftar pelaksana.' using errcode = '22023'; end if;
  if v_jumlah <> 100 then raise exception 'Jumlah porsi harus 100 persen (sekarang %).', v_jumlah using errcode = '22023'; end if;
  if v_pic is null then raise exception 'Pilih satu PIC.' using errcode = '22023'; end if;
  perform set_config('app.atur_pelaksana', '1', true);
  update public.kerja_pelaksana set lepas_at = now(), pic = false
   where kerja_id = k.id and lepas_at is null and orang_id not in (select (x ->> 'orang_id')::uuid from jsonb_array_elements(p_daftar) x);
  update public.kerja_pelaksana set pic = false where kerja_id = k.id and pic;
  insert into public.kerja_pelaksana (kerja_id, perusahaan_id, orang_id, porsi, pic)
  select k.id, v_pid, (x ->> 'orang_id')::uuid, (x ->> 'porsi')::smallint, coalesce((x ->> 'pic')::boolean, false) from jsonb_array_elements(p_daftar) x
  on conflict (kerja_id, orang_id) do update set porsi = excluded.porsi, pic = excluded.pic, lepas_at = null;
  update public.kerja set pelaksana_id = v_pic, diubah_at = now() where id = k.id;
  perform set_config('app.atur_pelaksana', '0', true);
  insert into public.kejadian (perusahaan_id, jenis, sumber, orang_id, kerja_id, data)
  values (v_pid, 'kerja.tim', 'pwa', v_pic, k.id, jsonb_build_object('oleh', auth.uid(), 'pelaksana', p_daftar));
  return jsonb_build_object('id', k.id, 'pic', v_pic, 'pelaksana', jsonb_array_length(p_daftar));
end $$;

-- Nama rekan satu usaha untuk daftar tim di papan (RLS orang membatasi staf ke dirinya sendiri; nama rekan tidak rahasia).
create function app.nama_rekan(p_orang uuid) returns text language sql stable security definer set search_path = '' as $$
  select o.nama from public.orang o where o.id = p_orang and o.perusahaan_id = app.pid() and app.anggota_aktif()
$$;
revoke all on function app.nama_rekan(uuid) from public, anon;
grant execute on function app.nama_rekan(uuid) to authenticated;

-- Pengelola atau pelaksana kerja itu.
create function app.boleh_kerja(p_kerja uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.pid() is not null and (app.anggota_aktif(array['pemilik', 'admin'])
    or (app.anggota_aktif() and exists (select 1 from app.kerja_porsi(app.pid()) kp where kp.kerja_id = p_kerja and kp.orang_id = app.orang_saya())))
    and exists (select 1 from public.kerja k where k.id = p_kerja and k.perusahaan_id = app.pid())
$$;

create function public.tambah_butir_kerja(p_kerja uuid, p_judul text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_judul text := btrim(regexp_replace(coalesce(p_judul, ''), '\s+', ' ', 'g')); v_id uuid;
begin
  if not app.boleh_kerja(p_kerja) then raise exception 'Kerja tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if char_length(v_judul) not between 1 and 200 then raise exception 'Tulis butir 1 sampai 200 huruf.' using errcode = '22023'; end if;
  if (select count(*) from public.kerja_butir where kerja_id = p_kerja and not batal) >= 50 then raise exception 'Paling banyak 50 butir per kerja.' using errcode = 'P0429'; end if;
  insert into public.kerja_butir (perusahaan_id, kerja_id, judul, urutan, dibuat_oleh)
  values (app.pid(), p_kerja, v_judul, coalesce((select max(urutan) + 1 from public.kerja_butir where kerja_id = p_kerja), 0), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create function public.centang_butir_kerja(p_butir uuid, p_selesai boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.kerja_butir;
begin
  select * into b from public.kerja_butir where id = p_butir and perusahaan_id = app.pid() and not batal for update;
  if b.id is null or not app.boleh_kerja(b.kerja_id) then raise exception 'Butir tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  update public.kerja_butir set selesai = coalesce(p_selesai, false),
    selesai_oleh = case when p_selesai then auth.uid() end, selesai_at = case when p_selesai then now() end where id = b.id;
  return jsonb_build_object('id', b.id, 'selesai', coalesce(p_selesai, false));
end $$;

create function public.batal_butir_kerja(p_butir uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.kerja_butir;
begin
  select * into b from public.kerja_butir where id = p_butir and perusahaan_id = app.pid() for update;
  if b.id is null or not app.boleh_kerja(b.kerja_id) then raise exception 'Butir tidak ditemukan di usahamu.' using errcode = 'P0002'; end if;
  if not app.anggota_aktif(array['pemilik', 'admin']) and b.dibuat_oleh is distinct from auth.uid() then
    raise exception 'Hanya pengelola atau pembuat butir yang bisa membatalkannya.' using errcode = '42501';
  end if;
  update public.kerja_butir set batal = true where id = b.id;
  return jsonb_build_object('id', b.id, 'batal', true);
end $$;

revoke all on function public.atur_pelaksana_kerja(uuid, jsonb), public.tambah_butir_kerja(uuid, text), public.centang_butir_kerja(uuid, boolean),
  public.batal_butir_kerja(uuid) from public, anon;
grant execute on function public.atur_pelaksana_kerja(uuid, jsonb), public.tambah_butir_kerja(uuid, text), public.centang_butir_kerja(uuid, boolean),
  public.batal_butir_kerja(uuid) to authenticated;
revoke all on function app.kerja_porsi(uuid), app.kerja_saya(), app.boleh_kerja(uuid), app.sinkron_pelaksana_kerja() from public, anon, authenticated;
grant execute on function app.kerja_saya(), app.boleh_kerja(uuid), app.kerja_porsi(uuid) to authenticated;

-- Fungsi yang membagi poin per orang: potongan yang diganti dicocokkan tepat sekali (gagal bila tidak ditemukan).
do $$
declare r record; f text; v_def text;
begin
  create temp table _ganti (urut serial, fungsi text, lama text, baru text) on commit drop;
  insert into _ganti (fungsi, lama, baru) select * from (values
    ('app.beban_orang(uuid,date)', 'select k.pelaksana_id, coalesce(k.poin_beban, 0) as poin,',
       'select kp.orang_id as pelaksana_id, round(coalesce(k.poin_beban, 0) * kp.porsi / 100.0, 2) as poin,'),
    ('app.beban_orang(uuid,date)', 'from public.kerja k cross join w
     where k.perusahaan_id = p_pid and k.pelaksana_id is not null and k.status <> ''batal''',
       'from public.kerja k join app.kerja_porsi(p_pid) kp on kp.kerja_id = k.id cross join w
     where k.perusahaan_id = p_pid and k.status <> ''batal'''),
    ('app.kpi_orang(uuid,date)', 'select k.id, k.judul, k.pelaksana_id, coalesce(k.poin_beban, 0) as poin,',
       'select k.id, k.judul, kp.orang_id as pelaksana_id, round(coalesce(k.poin_beban, 0) * kp.porsi / 100.0, 2) as poin,'),
    ('app.kpi_orang(uuid,date)', 'from public.kerja k cross join w
      left join lateral',
       'from public.kerja k join app.kerja_porsi(p_pid) kp on kp.kerja_id = k.id cross join w
      left join lateral'),
    ('app.kpi_orang(uuid,date)', 'where k.perusahaan_id = p_pid and k.status = ''selesai'' and k.pelaksana_id is not null',
       'where k.perusahaan_id = p_pid and k.status = ''selesai'''),
    ('app.kolam_poin(uuid,timestamp with time zone,timestamp with time zone,jsonb)', 'select k.id, k.pelaksana_id, coalesce(k.poin_beban, 0) as poin, k.selesai_at,',
       'select k.id, kp.orang_id as pelaksana_id, round(coalesce(k.poin_beban, 0) * kp.porsi / 100.0, 2) as poin, k.selesai_at,'),
    ('app.kolam_poin(uuid,timestamp with time zone,timestamp with time zone,jsonb)', 'from public.kerja k
     where k.perusahaan_id = p_pid and k.status = ''selesai'' and k.pelaksana_id is not null',
       'from public.kerja k join app.kerja_porsi(p_pid) kp on kp.kerja_id = k.id
     where k.perusahaan_id = p_pid and k.status = ''selesai'''),
    ('public.ubah_status_kerja(uuid,text)', 'if k.id is null or not (v_pengelola or (v_saya is not null and k.pelaksana_id = v_saya)) then',
       'if k.id is null or not (v_pengelola or (v_saya is not null and (k.pelaksana_id = v_saya
       or exists (select 1 from public.kerja_pelaksana kp where kp.kerja_id = k.id and kp.orang_id = v_saya and kp.lepas_at is null)))) then'),
    ('public.papan_kerja()', '''saya'', b.pelaksana_id is not null and b.pelaksana_id = (select app.orang_saya())',
       '''saya'', (b.pelaksana_id is not null and b.pelaksana_id = (select app.orang_saya()))
                   or exists (select 1 from public.kerja_pelaksana kp where kp.kerja_id = b.id and kp.orang_id = (select app.orang_saya()) and kp.lepas_at is null),
           ''tim'', (select coalesce(jsonb_agg(jsonb_build_object(''id'', kp.orang_id, ''nama'', app.nama_rekan(kp.orang_id), ''porsi'', kp.porsi, ''pic'', kp.pic)
                     order by kp.pic desc, app.nama_rekan(kp.orang_id)), ''[]'') from public.kerja_pelaksana kp where kp.kerja_id = b.id and kp.lepas_at is null),
           ''butir'', (select jsonb_build_object(''selesai'', count(*) filter (where kb.selesai), ''total'', count(*))
                       from public.kerja_butir kb where kb.kerja_id = b.id and not kb.batal)')
  ) t(fungsi, lama, baru);
  -- semua potongan satu fungsi diganti dulu, baru fungsi itu dibuat ulang sekali
  for f in select distinct g.fungsi from _ganti g loop
    v_def := pg_get_functiondef(f::regprocedure);
    for r in select * from _ganti g where g.fungsi = f order by g.urut loop
      if (length(v_def) - length(replace(v_def, r.lama, ''))) / length(r.lama) <> 1 then
        raise exception 'kerja_tim: potongan tidak ditemukan tepat satu kali di %: %', r.fungsi, left(r.lama, 80);
      end if;
      v_def := replace(v_def, r.lama, r.baru);
    end loop;
    execute v_def;
  end loop;
end $$;
