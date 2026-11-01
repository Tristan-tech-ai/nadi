-- F3-06 Jadwal shift (docs/research/shift-f3-06-sql.md, shift-f3-06.md; tes supabase/tests/shift.test.sql). Satu baris = satu shift
-- satu orang; tanggal = hari mulai di zona usaha (shift lewat tengah malam tetap satu baris); mulai_at/selesai_at diisi RPC dari zona
-- usaha. Batas PP 35/2021 Pasal 21 ayat (2) dari pola kerja usaha (app.pola_kerja): 7 jam/hari (6 hari) atau 8 jam/hari (5 hari),
-- 40 jam/minggu; selebihnya lembur, paling lama 4 jam/hari dan 18 jam/minggu (Pasal 26, sama dengan catat_lembur) dan butuh
-- persetujuan pekerja (persetujuan_lembur). Tumpang tindih ditolak RPC dan exclusion constraint (btree_gist). Shift tidak dihapus:
-- dibatalkan (status batal), dan hanya shift yang belum lewat. Peran lewat app.peran_aktif / app.orang_saya.

create extension if not exists btree_gist with schema extensions;

create table public.shift (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tanggal date not null,
  mulai time not null,
  selesai time not null,
  istirahat_menit integer not null default 0 check (istirahat_menit between 0 and 240),
  mulai_at timestamptz not null,
  selesai_at timestamptz not null,
  topi_id uuid references public.topi(id) on delete set null,
  status text not null default 'aktif' check (status in ('aktif', 'batal')),
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  check (selesai_at > mulai_at and selesai_at - mulai_at <= interval '16 hours'),
  unique (perusahaan_id, kunci_klien),
  constraint shift_tanpa_tumpang exclude using gist (orang_id with =, tstzrange(mulai_at, selesai_at) with &&) where (status = 'aktif')
);
create index on public.shift (perusahaan_id, tanggal);
create index on public.shift (orang_id, tanggal);
create index on public.shift (topi_id);

create table public.persetujuan_lembur (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  shift_id uuid not null unique references public.shift(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  menit_lembur integer not null check (menit_lembur > 0),
  status text not null default 'menunggu' check (status in ('menunggu', 'setuju', 'tidak')),
  dijawab_at timestamptz,
  dibuat_at timestamptz not null default now()
);
create index on public.persetujuan_lembur (orang_id);

alter table public.shift enable row level security;
alter table public.persetujuan_lembur enable row level security;
create policy shift_baca on public.shift for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or orang_id = (select app.orang_saya())));
create policy persetujuan_lembur_baca on public.persetujuan_lembur for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or orang_id = (select app.orang_saya())));
grant select on public.shift, public.persetujuan_lembur to authenticated;
create trigger audit_shift after insert or update or delete on public.shift for each row execute function app.catat_audit();
create trigger audit_persetujuan_lembur after insert or update or delete on public.persetujuan_lembur for each row execute function app.catat_audit();

-- Menit kerja bersih satu shift (selesai <= mulai berarti esok hari).
create or replace function app.menit_shift(p_mulai time, p_selesai time, p_istirahat integer) returns integer
language sql immutable set search_path = '' as $$
  select (extract(epoch from (case when p_selesai > p_mulai then p_selesai - p_mulai else p_selesai - p_mulai + interval '24 hours' end)) / 60)::int - p_istirahat
$$;

-- Lembur satu orang dalam minggu tanggal itu: per hari di atas jam normal, dan minggu di atas 40 jam (diambil yang terbesar).
create or replace function app.lembur_minggu(p_pid uuid, p_orang uuid, p_tanggal date) returns table(hari date, menit integer, lembur_hari integer, total_minggu integer, lembur_minggu integer, hari_kerja integer)
language sql stable security definer set search_path = '' as $$
  with normal as (select case app.pola_kerja(p_pid) when '5_hari' then 480 else 420 end as n),
  per_hari as (
    select s.tanggal, sum(app.menit_shift(s.mulai, s.selesai, s.istirahat_menit))::int as menit
      from public.shift s
     where s.orang_id = p_orang and s.status = 'aktif'
       and s.tanggal >= date_trunc('week', p_tanggal)::date and s.tanggal < date_trunc('week', p_tanggal)::date + 7
     group by s.tanggal)
  select h.tanggal, h.menit, greatest(0, h.menit - (select n from normal)),
         (sum(h.menit) over ())::int,
         greatest((sum(greatest(0, h.menit - (select n from normal))) over ())::int, (sum(h.menit) over ())::int - 2400),
         (count(*) over ())::int
    from per_hari h
$$;

create or replace function public.simpan_shift(p_orang uuid, p_tanggal date, p_mulai time, p_selesai time, p_istirahat integer, p_topi uuid, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_zona text; s public.shift; v_mulai timestamptz; v_selesai timestamptz; v_bruto integer; l record;
  v_lembur_hari integer := 0; v_peringatan text[] := '{}'; v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun jadwal' using errcode = '42501';
  end if;
  select * into s from public.shift where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then
    return jsonb_build_object('id', s.id, 'sudah', true, 'peringatan', '[]'::jsonb);
  end if;
  if not exists (select 1 from public.orang o where o.id = p_orang and o.perusahaan_id = v_pid and o.status = 'aktif') then
    raise exception 'Orang aktif tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if p_tanggal is null or p_mulai is null or p_selesai is null or p_istirahat is null or p_istirahat not between 0 and 240 then
    raise exception 'Isi tanggal, jam mulai, jam selesai, dan istirahat (0 sampai 240 menit)' using errcode = '22023';
  end if;
  v_zona := app.zona(v_pid);
  v_mulai := (p_tanggal + p_mulai) at time zone v_zona;
  v_selesai := ((case when p_selesai > p_mulai then p_tanggal else p_tanggal + 1 end) + p_selesai) at time zone v_zona;
  v_bruto := (extract(epoch from v_selesai - v_mulai) / 60)::int;
  if v_bruto > 960 or v_bruto - p_istirahat <= 0 then
    raise exception 'Shift paling lama 16 jam dan harus lebih panjang dari istirahatnya' using errcode = '22023';
  end if;
  if exists (select 1 from public.shift x where x.orang_id = p_orang and x.status = 'aktif'
               and tstzrange(x.mulai_at, x.selesai_at) && tstzrange(v_mulai, v_selesai)) then
    raise exception 'Bertabrakan dengan shift lain orang ini' using errcode = '23P01';
  end if;
  insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, topi_id, kunci_klien, dibuat_oleh)
  values (v_pid, p_orang, p_tanggal, p_mulai, p_selesai, p_istirahat, v_mulai, v_selesai, p_topi, p_kunci, auth.uid())
  returning id into v_id;
  for l in select * from app.lembur_minggu(v_pid, p_orang, p_tanggal) loop
    if l.lembur_hari > 240 then
      raise exception 'Lembur paling lama 4 jam sehari (PP 35/2021 Pasal 26). Hari ini jadi % jam.', round(l.lembur_hari / 60.0, 1) using errcode = '54000';
    end if;
    if l.lembur_minggu > 1080 then
      raise exception 'Lembur paling lama 18 jam seminggu (PP 35/2021 Pasal 26). Minggu ini jadi % jam.', round(l.lembur_minggu / 60.0, 1) using errcode = '54000';
    end if;
    if l.hari = p_tanggal then v_lembur_hari := l.lembur_hari; end if;
    if l.hari_kerja > (case app.pola_kerja(v_pid) when '5_hari' then 5 else 6 end) and not 'kurang_libur' = any(v_peringatan) then
      v_peringatan := v_peringatan || 'kurang_libur';
    end if;
    if l.total_minggu > 2400 and not 'lewat_40_minggu' = any(v_peringatan) then
      v_peringatan := v_peringatan || 'lewat_40_minggu';
    end if;
  end loop;
  if v_bruto > 240 and p_istirahat < 30 then
    v_peringatan := v_peringatan || 'tanpa_istirahat';
  end if;
  if v_lembur_hari > 0 then
    insert into public.persetujuan_lembur (perusahaan_id, shift_id, orang_id, menit_lembur)
    values (v_pid, v_id, p_orang, least(v_lembur_hari, v_bruto - p_istirahat));
  end if;
  return jsonb_build_object('id', v_id, 'sudah', false, 'peringatan', to_jsonb(v_peringatan), 'lembur_menit', v_lembur_hari);
end $$;

create or replace function public.batal_shift(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s public.shift;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengubah jadwal' using errcode = '42501';
  end if;
  select * into s from public.shift where id = p_id and perusahaan_id = v_pid and status = 'aktif';
  if not found then
    raise exception 'Shift tidak ditemukan atau sudah dibatalkan' using errcode = 'P0002';
  end if;
  if s.tanggal < app.hari_ini(v_pid) then
    raise exception 'Shift yang sudah lewat tidak bisa dibatalkan' using errcode = '22023';
  end if;
  update public.shift set status = 'batal' where id = s.id;
  update public.persetujuan_lembur set status = 'tidak', dijawab_at = coalesce(dijawab_at, now()) where shift_id = s.id and status = 'menunggu';
end $$;

-- Salin satu minggu ke minggu lain: tidak menimpa dan tidak menggandakan (kunci turunan dari shift asal + tanggal tujuan).
create or replace function public.salin_jadwal(p_dari date, p_ke date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_zona text; s record; v_t date; v_mulai timestamptz; v_selesai timestamptz; n int := 0; v_kunci uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun jadwal' using errcode = '42501';
  end if;
  v_zona := app.zona(v_pid);
  for s in select * from public.shift where perusahaan_id = v_pid and status = 'aktif' and tanggal >= p_dari and tanggal < p_dari + 7 order by tanggal, mulai loop
    v_t := s.tanggal + (p_ke - p_dari);
    v_mulai := (v_t + s.mulai) at time zone v_zona;
    v_selesai := ((case when s.selesai > s.mulai then v_t else v_t + 1 end) + s.selesai) at time zone v_zona;
    v_kunci := md5(s.id::text || ':' || v_t::text)::uuid;
    continue when exists (select 1 from public.shift x where x.perusahaan_id = v_pid and x.kunci_klien = v_kunci);
    continue when exists (select 1 from public.shift x where x.orang_id = s.orang_id and x.status = 'aktif' and tstzrange(x.mulai_at, x.selesai_at) && tstzrange(v_mulai, v_selesai));
    continue when not exists (select 1 from public.orang o where o.id = s.orang_id and o.status = 'aktif');
    insert into public.shift (perusahaan_id, orang_id, tanggal, mulai, selesai, istirahat_menit, mulai_at, selesai_at, topi_id, kunci_klien, dibuat_oleh)
    values (v_pid, s.orang_id, v_t, s.mulai, s.selesai, s.istirahat_menit, v_mulai, v_selesai, s.topi_id, v_kunci, auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.jawab_lembur(p_id uuid, p_setuju boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or p_setuju is null then
    raise exception 'Jawaban tidak dikenal' using errcode = '22023';
  end if;
  update public.persetujuan_lembur set status = case when p_setuju then 'setuju' else 'tidak' end, dijawab_at = now()
   where id = p_id and perusahaan_id = v_pid and orang_id = (select app.orang_saya());
  if not found then
    raise exception 'Permintaan lembur ini bukan untukmu' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.jadwal_minggu(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_mulai date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang melihat jadwal semua orang' using errcode = '42501';
  end if;
  v_mulai := date_trunc('week', coalesce(p_mulai, app.hari_ini(v_pid)))::date;
  return jsonb_build_object('mulai', v_mulai, 'pola_kerja', app.pola_kerja(v_pid), 'orang', coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama,
             'menit', coalesce((select sum(app.menit_shift(s.mulai, s.selesai, s.istirahat_menit)) from public.shift s
                                 where s.orang_id = o.id and s.status = 'aktif' and s.tanggal >= v_mulai and s.tanggal < v_mulai + 7), 0),
             'shift', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tanggal', s.tanggal, 'mulai', to_char(s.mulai, 'HH24:MI'),
                                   'selesai', to_char(s.selesai, 'HH24:MI'), 'istirahat', s.istirahat_menit,
                                   'lembur', (select p.status from public.persetujuan_lembur p where p.shift_id = s.id)) order by s.tanggal, s.mulai)
                                 from public.shift s where s.orang_id = o.id and s.status = 'aktif' and s.tanggal >= v_mulai and s.tanggal < v_mulai + 7), '[]'::jsonb))
           order by o.nama)
      from public.orang o where o.perusahaan_id = v_pid and o.status = 'aktif' and o.jenis && array['karyawan', 'magang']), '[]'::jsonb));
end $$;

create or replace function public.jadwal_saya(p_mulai date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := app.orang_saya(); v_mulai date;
begin
  if v_pid is null or v_orang is null then
    raise exception 'Akunmu belum tertaut ke orang di usaha ini' using errcode = '42501';
  end if;
  v_mulai := date_trunc('week', coalesce(p_mulai, app.hari_ini(v_pid)))::date;
  return jsonb_build_object('mulai', v_mulai,
    'shift', coalesce((select jsonb_agg(jsonb_build_object('tanggal', s.tanggal, 'mulai', to_char(s.mulai, 'HH24:MI'), 'selesai', to_char(s.selesai, 'HH24:MI'),
               'istirahat', s.istirahat_menit) order by s.tanggal, s.mulai)
             from public.shift s where s.orang_id = v_orang and s.status = 'aktif' and s.tanggal >= v_mulai and s.tanggal < v_mulai + 14), '[]'::jsonb),
    'lembur', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'tanggal', s.tanggal, 'menit', p.menit_lembur) order by s.tanggal)
             from public.persetujuan_lembur p join public.shift s on s.id = p.shift_id
            where p.orang_id = v_orang and p.status = 'menunggu' and s.status = 'aktif'), '[]'::jsonb));
end $$;

-- Untuk beban (F3-02) dan KPI hadir (F3-03): menit terjadwal per orang dalam minggu.
create or replace function app.jam_jadwal(p_pid uuid, p_mulai date) returns table(orang_id uuid, menit integer)
language sql stable security definer set search_path = '' as $$
  select s.orang_id, sum(app.menit_shift(s.mulai, s.selesai, s.istirahat_menit))::int
    from public.shift s
   where s.perusahaan_id = p_pid and s.status = 'aktif' and s.tanggal >= p_mulai and s.tanggal < p_mulai + 7
   group by s.orang_id
$$;

revoke all on function app.menit_shift(time, time, integer), app.lembur_minggu(uuid, uuid, date), app.jam_jadwal(uuid, date) from public, anon, authenticated;
revoke all on function public.simpan_shift(uuid, date, time, time, integer, uuid, uuid), public.batal_shift(uuid), public.salin_jadwal(date, date),
  public.jawab_lembur(uuid, boolean), public.jadwal_minggu(date), public.jadwal_saya(date) from public, anon;
grant execute on function public.simpan_shift(uuid, date, time, time, integer, uuid, uuid), public.batal_shift(uuid), public.salin_jadwal(date, date),
  public.jawab_lembur(uuid, boolean), public.jadwal_minggu(date), public.jadwal_saya(date) to authenticated;
