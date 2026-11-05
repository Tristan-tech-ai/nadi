-- M-14 rekrutmen lanjutan: sumber pelamar (?src= di tautan /lamar), jadwal wawancara (berkas .ics dibuat di aplikasi dan di halaman
-- status pelamar), laporan rekrutmen (pelamar per tahap dan sumber, hari sampai terisi, biaya iklan per pelamar), rencana kebutuhan
-- orang per topi per tahun (target, anggaran, terisi, lowongan buka), rincian lowongan untuk data terstruktur JobPosting
-- (Google Search Central: datePosted, description, hiringOrganization, jobLocation dengan addressCountry, title; dibaca 6 Nov 2026).

alter table public.lamaran add column source text check (source is null or source ~ '^[a-z0-9_]{1,30}$');

alter table public.lowongan
  add column city text check (city is null or char_length(city) between 2 and 80),
  add column region text check (region is null or char_length(region) between 2 and 80),
  add column employment_type text not null default 'FULL_TIME'
    check (employment_type in ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER')),
  add column salary_min bigint check (salary_min is null or salary_min > 0),
  add column salary_max bigint check (salary_max is null or salary_max > 0),
  add column salary_unit text not null default 'MONTH' check (salary_unit in ('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR')),
  add column valid_through date,
  add column indexable boolean not null default false,
  add constraint lowongan_gaji_urut check (salary_min is null or salary_max is null or salary_max >= salary_min);

create table public.interview_slot (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  lamaran_id uuid not null references public.lamaran(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null check (char_length(location) between 2 and 200),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  sequence integer not null default 0,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  unique (perusahaan_id, kunci_klien)
);
create index interview_slot_waktu on public.interview_slot (perusahaan_id, starts_at) where status = 'scheduled';

create table public.manpower_plan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  topi_id uuid not null references public.topi(id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  headcount integer not null check (headcount between 0 and 100000),
  monthly_budget bigint not null default 0 check (monthly_budget >= 0),
  note text check (note is null or char_length(note) <= 300),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, topi_id, year)
);

alter table public.interview_slot enable row level security;
alter table public.manpower_plan enable row level security;
create policy interview_slot_baca on public.interview_slot for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy manpower_plan_baca on public.manpower_plan for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.interview_slot, public.manpower_plan to authenticated;

-- Pelamar (anon) menandai sumber tautan sekali, dalam 2 jam sejak melamar (pola lamar_lanjut).
create or replace function public.tag_application_source(p_lamaran uuid, p_source text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := lower(left(regexp_replace(coalesce(p_source, ''), '[^A-Za-z0-9_]', '', 'g'), 30));
begin
  if v = '' then return; end if;
  update public.lamaran set source = v where id = p_lamaran and source is null and dibuat_at > now() - interval '2 hours';
end $$;

-- Rincian lowongan untuk JobPosting dan pencarian. p: {kota, wilayah, jenis, gaji_min, gaji_max, gaji_satuan, berlaku_sampai, terindeks}.
create or replace function public.save_job_details(p_lowongan uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengubah lowongan' using errcode = '42501';
  end if;
  if coalesce((p ->> 'terindeks')::boolean, false) and nullif(btrim(coalesce(p ->> 'kota', '')), '') is null then
    raise exception 'Lowongan yang tampil di pencarian butuh kota tempat kerja' using errcode = '22023';
  end if;
  update public.lowongan set city = nullif(btrim(coalesce(p ->> 'kota', '')), ''), region = nullif(btrim(coalesce(p ->> 'wilayah', '')), ''),
    employment_type = coalesce(nullif(p ->> 'jenis', ''), 'FULL_TIME'), salary_min = (p ->> 'gaji_min')::bigint, salary_max = (p ->> 'gaji_max')::bigint,
    salary_unit = coalesce(nullif(p ->> 'gaji_satuan', ''), 'MONTH'), valid_through = (p ->> 'berlaku_sampai')::date,
    indexable = coalesce((p ->> 'terindeks')::boolean, false)
  where id = p_lowongan and perusahaan_id = v_pid;
  if not found then raise exception 'Lowongan tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

create or replace function public.lowongan_publik(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('judul', l.judul, 'ringkasan', l.ringkasan, 'usaha', p.nama, 'buka', l.buka, 'pertanyaan', l.pertanyaan,
           'dibuat_at', l.dibuat_at, 'kota', l.city, 'wilayah', l.region, 'jenis', l.employment_type, 'gaji_min', l.salary_min, 'gaji_max', l.salary_max,
           'gaji_satuan', l.salary_unit, 'berlaku_sampai', l.valid_through, 'terindeks', l.indexable)
    from public.lowongan l join public.perusahaan p on p.id = l.perusahaan_id where l.kode = upper(p_kode)
$$;

-- Jadwal wawancara: pemilik/admin. Mengembalikan jumlah wawancara lain yang bertumpuk (boleh, pewawancara bisa berbeda).
create or replace function public.schedule_interview(p_lamaran uuid, p_mulai timestamptz, p_durasi integer, p_lokasi text, p_catatan text, p_kunci uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); la public.lamaran; s public.interview_slot; v_bentrok int;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menjadwalkan wawancara' using errcode = '42501';
  end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into s from public.interview_slot where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', s.id, 'bentrok', 0, 'baru', false); end if;
  select * into la from public.lamaran where id = p_lamaran and perusahaan_id = v_pid;
  if not found then raise exception 'Lamaran tidak ditemukan' using errcode = 'P0002'; end if;
  if la.tahap in ('diterima', 'ditolak') then raise exception 'Lamaran ini sudah selesai (%)', la.tahap using errcode = '22023'; end if;
  if p_mulai is null or p_mulai < now() - interval '5 minutes' or p_mulai > now() + interval '180 days' then
    raise exception 'Pilih waktu wawancara mulai sekarang sampai 180 hari ke depan' using errcode = '22023';
  end if;
  if p_durasi is null or p_durasi not between 15 and 480 then raise exception 'Lama wawancara 15 sampai 480 menit' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_lokasi, ''))) < 2 then raise exception 'Tulis tempat atau tautan wawancara' using errcode = '22023'; end if;
  insert into public.interview_slot (perusahaan_id, lamaran_id, starts_at, ends_at, location, note, kunci_klien, dibuat_oleh)
  values (v_pid, la.id, p_mulai, p_mulai + make_interval(mins => p_durasi), left(btrim(p_lokasi), 200), nullif(left(btrim(coalesce(p_catatan, '')), 500), ''), p_kunci, auth.uid())
  returning * into s;
  select count(*) into v_bentrok from public.interview_slot x
   where x.perusahaan_id = v_pid and x.status = 'scheduled' and x.id <> s.id and tstzrange(x.starts_at, x.ends_at) && tstzrange(s.starts_at, s.ends_at);
  if la.tahap = 'masuk' then update public.lamaran set tahap = 'ditinjau', tahap_at = now() where id = la.id; end if;
  return jsonb_build_object('id', s.id, 'bentrok', v_bentrok, 'baru', true);
end $$;

create or replace function public.cancel_interview(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membatalkan wawancara' using errcode = '42501';
  end if;
  update public.interview_slot set status = 'cancelled', sequence = sequence + 1 where id = p_id and perusahaan_id = v_pid and status = 'scheduled';
  if not found then raise exception 'Jadwal wawancara tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Status pelamar kini menyertakan jadwal wawancara yang belum lewat (untuk disimpan ke kalender HP pelamar).
create or replace function public.status_lamaran(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('usaha', p.nama, 'lowongan', l.judul, 'nama', la.nama, 'tahap', la.tahap, 'pesan', la.pesan_tahap,
           'tahap_at', la.tahap_at, 'dibuat_at', la.dibuat_at, 'zona', p.zona_waktu,
           'wawancara', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'mulai', s.starts_at, 'selesai', s.ends_at, 'lokasi', s.location,
                                   'catatan', s.note, 'urutan', s.sequence) order by s.starts_at)
                                  from public.interview_slot s where s.lamaran_id = la.id and s.status = 'scheduled' and s.ends_at > now()), '[]'))
    into r
    from public.lamaran la join public.lowongan l on l.id = la.lowongan_id join public.perusahaan p on p.id = la.perusahaan_id
   where la.token_status = app.hash_token(coalesce(p_token, '')) and la.dibuat_at > now() - interval '180 days';
  if r is null then
    raise exception 'Tautan status lamaran ini tidak berlaku. Tautan berlaku 180 hari sejak melamar; tanyakan kabarnya langsung ke usaha tempatmu melamar.'
      using errcode = '28000';
  end if;
  return r;
end $$;

-- Laporan rekrutmen per lowongan dan per sumber untuk lamaran masuk di rentang tanggal (zona usaha).
create or replace function public.recruitment_report(p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_zona text;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat laporan rekrutmen' using errcode = '42501';
  end if;
  select zona_waktu into v_zona from public.perusahaan where id = v_pid;
  return (with la as (
      select x.* from public.lamaran x where x.perusahaan_id = v_pid and (x.dibuat_at at time zone v_zona)::date between p_dari and p_sampai),
    per_low as (
      select l.id, l.judul, l.kode, l.buka, l.biaya_iklan, count(la.id) n,
             count(la.id) filter (where la.tahap = 'masuk') masuk, count(la.id) filter (where la.tahap = 'ditinjau') ditinjau,
             count(la.id) filter (where la.tahap = 'ditawari') ditawari, count(la.id) filter (where la.tahap = 'diterima') diterima,
             count(la.id) filter (where la.tahap = 'ditolak') ditolak,
             (select round(extract(epoch from min(y.tahap_at) - l.dibuat_at) / 86400.0, 1) from public.lamaran y where y.lowongan_id = l.id and y.tahap = 'diterima') hari_isi
        from public.lowongan l left join la on la.lowongan_id = l.id where l.perusahaan_id = v_pid
       group by l.id having count(la.id) > 0 or l.buka)
    select jsonb_build_object(
      'pelamar', (select count(*) from la),
      'diterima', (select count(*) from la where tahap = 'diterima'),
      'rata_hari_isi', (select round(avg(hari_isi), 1) from per_low where hari_isi is not null),
      'lowongan', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'judul', judul, 'kode', kode, 'buka', buka, 'pelamar', n, 'masuk', masuk, 'ditinjau', ditinjau,
                    'ditawari', ditawari, 'diterima', diterima, 'ditolak', ditolak, 'hari_isi', hari_isi, 'biaya_iklan', biaya_iklan,
                    'biaya_per_pelamar', case when n > 0 and biaya_iklan > 0 then round(biaya_iklan::numeric / n) end) order by n desc, judul) from per_low), '[]'),
      'sumber', coalesce((select jsonb_agg(jsonb_build_object('sumber', s, 'pelamar', n, 'diterima', d) order by n desc) from
                  (select coalesce(source, 'langsung') s, count(*) n, count(*) filter (where tahap = 'diterima') d from la group by 1) q), '[]')));
end $$;

create or replace function public.save_manpower_plan(p_topi uuid, p_tahun integer, p_headcount integer, p_anggaran bigint, p_catatan text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menyusun rencana kebutuhan orang' using errcode = '42501';
  end if;
  if not exists (select 1 from public.topi where id = p_topi and perusahaan_id = v_pid) then raise exception 'Topi tidak ditemukan' using errcode = 'P0002'; end if;
  insert into public.manpower_plan (perusahaan_id, topi_id, year, headcount, monthly_budget, note, diubah_oleh)
  values (v_pid, p_topi, p_tahun, p_headcount, coalesce(p_anggaran, 0), nullif(left(btrim(coalesce(p_catatan, '')), 300), ''), auth.uid())
  on conflict (perusahaan_id, topi_id, year) do update set headcount = excluded.headcount, monthly_budget = excluded.monthly_budget, note = excluded.note,
    diubah_oleh = excluded.diubah_oleh, diubah_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Rencana vs keadaan: terisi = orang aktif yang memakai topi itu hari ini; lowongan buka per topi.
create or replace function public.manpower_report(p_tahun integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_hari date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang melihat rencana kebutuhan orang' using errcode = '42501';
  end if;
  v_hari := (now() at time zone coalesce((select zona_waktu from public.perusahaan where id = v_pid), 'Asia/Jakarta'))::date;
  return coalesce((select jsonb_agg(jsonb_build_object('topi', t.id, 'nama', t.nama, 'target', m.headcount, 'anggaran', m.monthly_budget, 'catatan', m.note,
      'terisi', (select count(distinct pt.orang_id) from public.pakai_topi pt join public.orang o on o.id = pt.orang_id
                  where pt.topi_id = t.id and o.status = 'aktif' and pt.mulai <= v_hari and (pt.selesai is null or pt.selesai >= v_hari)),
      'lowongan_buka', (select count(*) from public.lowongan l where l.topi_id = t.id and l.buka)) order by t.nama)
    from public.manpower_plan m join public.topi t on t.id = m.topi_id where m.perusahaan_id = v_pid and m.year = p_tahun), '[]');
end $$;

revoke all on function public.tag_application_source(uuid, text), public.save_job_details(uuid, jsonb), public.schedule_interview(uuid, timestamptz, integer, text, text, uuid),
  public.cancel_interview(uuid), public.recruitment_report(date, date), public.save_manpower_plan(uuid, integer, integer, bigint, text), public.manpower_report(integer) from public;
grant execute on function public.tag_application_source(uuid, text) to anon, authenticated;
grant execute on function public.save_job_details(uuid, jsonb), public.schedule_interview(uuid, timestamptz, integer, text, text, uuid), public.cancel_interview(uuid),
  public.recruitment_report(date, date), public.save_manpower_plan(uuid, integer, integer, bigint, text), public.manpower_report(integer) to authenticated;
