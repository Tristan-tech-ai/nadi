-- W-07D anggaran proyek vs realisasi + jam kerja per proyek (docs/research/kebutuhan-usaha.md urut 4): kontraktor, agensi, konsultan.
-- Proyek = dimensi jenis 'proyek' dari M-08. RAB per akun (beban, dan pendapatan untuk nilai kontrak); realisasi = jurnal bertag proyek
-- itu sepanjang umur proyek (tag manual, aturan kata, atau jurnal berulang). Lembar jam: anggota mencatat jamnya sendiri, pengelola untuk
-- siapa pun. Perkiraan biaya tenaga = jam x (pokok + tunjangan tetap) / 173 (upah sejam PP 35/2021 Pasal 31, LEARN 31 Okt 2026), hanya
-- untuk pemilik/admin karena memakai data gaji, dan tidak dijurnal (gaji sudah dijurnal lewat slip).

create table public.project_budget (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dimension_id uuid not null,
  akun_id uuid not null references public.akun(id) on delete cascade,
  nominal bigint not null check (nominal between 0 and 1000000000000),
  catatan text check (catatan is null or length(catatan) <= 200),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, dimension_id, akun_id),
  foreign key (perusahaan_id, dimension_id) references public.dimension (perusahaan_id, id) on delete cascade
);
alter table public.project_budget enable row level security;
create policy project_budget_baca on public.project_budget for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.project_budget to authenticated;
create trigger audit_project_budget after insert or update or delete on public.project_budget for each row execute function app.catat_audit();

create table public.project_time (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dimension_id uuid not null,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tanggal date not null,
  jam numeric(5,2) not null check (jam > 0 and jam <= 24),
  catatan text check (catatan is null or length(catatan) <= 200),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  foreign key (perusahaan_id, dimension_id) references public.dimension (perusahaan_id, id) on delete cascade
);
create index project_time_proyek on public.project_time (perusahaan_id, dimension_id, tanggal);
alter table public.project_time enable row level security;
-- Pengelola melihat semua; anggota melihat jamnya sendiri.
create policy project_time_baca on public.project_time for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan')
         or orang_id = (select a.orang_id from public.anggota a where a.perusahaan_id = (select app.pid()) and a.user_id = (select auth.uid()) and a.aktif)));
grant select on public.project_time to authenticated;

create or replace function app.wajib_proyek(p_dimension uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or not (select app.anggota_aktif()) then raise exception 'Masuk sebagai anggota usaha ini dulu' using errcode = '42501'; end if;
  if not exists (select 1 from public.dimension where id = p_dimension and perusahaan_id = v_pid and jenis = 'proyek' and aktif) then
    raise exception 'Proyek tidak ditemukan' using errcode = 'P0002';
  end if;
  return v_pid;
end $$;

-- RAB satu baris per akun; nominal 0 = baris dihapus dari RAB (disimpan 0, bukan dibuang, agar jejak audit tetap ada).
create or replace function public.set_project_budget(p_dimension uuid, p_akun text, p_nominal bigint, p_catatan text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); a public.akun; v_id uuid;
begin
  perform app.wajib_proyek(p_dimension);
  select * into a from public.akun where perusahaan_id = v_pid and kode = p_akun and aktif;
  if not found or a.golongan not in ('beban', 'pendapatan') then raise exception 'Pilih akun beban atau pendapatan' using errcode = '22023'; end if;
  if p_nominal is null or p_nominal < 0 then raise exception 'Anggaran rupiah bulat tidak negatif' using errcode = '22023'; end if;
  insert into public.project_budget (perusahaan_id, dimension_id, akun_id, nominal, catatan, diubah_oleh)
  values (v_pid, p_dimension, a.id, p_nominal, nullif(left(btrim(coalesce(p_catatan, '')), 200), ''), auth.uid())
  on conflict (perusahaan_id, dimension_id, akun_id) do update set nominal = excluded.nominal, catatan = excluded.catatan, diubah_oleh = excluded.diubah_oleh, diubah_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Jam kerja: p_orang null = diri sendiri; orang lain hanya oleh pemilik/admin. Tanggal paling lama 60 hari lalu, tidak di masa depan.
create or replace function public.log_project_hours(p_dimension uuid, p_tanggal date, p_jam numeric, p_catatan text default null, p_orang uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_proyek(p_dimension); v_saya uuid; v_orang uuid; v_id uuid; v_hari date;
begin
  select a.orang_id into v_saya from public.anggota a where a.perusahaan_id = v_pid and a.user_id = auth.uid() and a.aktif;
  v_orang := coalesce(p_orang, v_saya);
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang. Minta pemilik menghubungkannya.' using errcode = '22023'; end if;
  if v_orang is distinct from v_saya and coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mencatat jam orang lain' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orang where id = v_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  v_hari := app.hari_ini(v_pid);
  if p_tanggal is null or p_tanggal > v_hari or p_tanggal < v_hari - 60 then raise exception 'Tanggal jam kerja: hari ini sampai 60 hari lalu' using errcode = '22023'; end if;
  if p_jam is null or p_jam <= 0 or p_jam > 24 then raise exception 'Jam kerja lebih dari 0 dan paling banyak 24' using errcode = '22023'; end if;
  if (select coalesce(sum(jam), 0) from public.project_time where perusahaan_id = v_pid and orang_id = v_orang and tanggal = p_tanggal) + p_jam > 24 then
    raise exception 'Jam kerja orang ini di tanggal itu melebihi 24 jam' using errcode = '22023';
  end if;
  insert into public.project_time (perusahaan_id, dimension_id, orang_id, tanggal, jam, catatan, dibuat_oleh)
  values (v_pid, p_dimension, v_orang, p_tanggal, round(p_jam, 2), nullif(left(btrim(coalesce(p_catatan, '')), 200), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.project_report(p_dimension uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); v_gaji boolean; v_baris jsonb; v_jam jsonb;
begin
  perform app.wajib_proyek(p_dimension);
  v_gaji := coalesce((select app.peran_aktif()), '') in ('pemilik', 'admin');
  with real as (
    select b.akun_id, sum(case when a.golongan = 'pendapatan' then b.kredit - b.debit else b.debit - b.kredit end)::bigint nilai
      from public.journal_tag t join public.jurnal j on j.id = t.jurnal_id and j.perusahaan_id = v_pid
      join public.jurnal_baris b on b.jurnal_id = j.id join public.akun a on a.id = b.akun_id and a.golongan in ('pendapatan', 'beban')
     where t.perusahaan_id = v_pid and t.dimension_id = p_dimension and t.jenis = 'proyek' and j.sumber <> 'tutup_buku'
     group by b.akun_id),
  gab as (
    select coalesce(pb.akun_id, r.akun_id) akun_id, coalesce(pb.nominal, 0) anggaran, coalesce(r.nilai, 0) realisasi
      from (select * from public.project_budget where perusahaan_id = v_pid and dimension_id = p_dimension and nominal > 0) pb
      full join real r on r.akun_id = pb.akun_id)
  select coalesce(jsonb_agg(jsonb_build_object('kode', a.kode, 'nama', a.nama, 'golongan', a.golongan, 'anggaran', g.anggaran, 'realisasi', g.realisasi,
           'selisih', g.anggaran - g.realisasi) order by a.golongan desc, a.kode), '[]')
    into v_baris from gab g join public.akun a on a.id = g.akun_id;
  select coalesce(jsonb_agg(jsonb_build_object('orang', x.orang_id, 'nama', o.nama, 'jam', x.jam,
           'biaya', case when v_gaji then round(x.jam * (coalesce((r.gaji ->> 'pokok')::numeric, 0) + coalesce((r.gaji ->> 'tunjangan_tetap')::numeric, 0)) / 173) end)
           order by x.jam desc), '[]')
    into v_jam
    from (select orang_id, sum(jam) jam from public.project_time where perusahaan_id = v_pid and dimension_id = p_dimension group by orang_id) x
    join public.orang o on o.id = x.orang_id left join public.orang_rahasia r on r.orang_id = x.orang_id;
  return jsonb_build_object('baris', v_baris, 'jam', v_jam,
    'beban_anggaran', (select coalesce(sum((e ->> 'anggaran')::bigint), 0) from jsonb_array_elements(v_baris) e where e ->> 'golongan' = 'beban'),
    'beban_realisasi', (select coalesce(sum((e ->> 'realisasi')::bigint), 0) from jsonb_array_elements(v_baris) e where e ->> 'golongan' = 'beban'),
    'pendapatan_anggaran', (select coalesce(sum((e ->> 'anggaran')::bigint), 0) from jsonb_array_elements(v_baris) e where e ->> 'golongan' = 'pendapatan'),
    'pendapatan_realisasi', (select coalesce(sum((e ->> 'realisasi')::bigint), 0) from jsonb_array_elements(v_baris) e where e ->> 'golongan' = 'pendapatan'),
    'total_jam', (select coalesce(sum((e ->> 'jam')::numeric), 0) from jsonb_array_elements(v_jam) e));
end $$;

revoke all on function app.wajib_proyek(uuid) from public, anon, authenticated;
revoke all on function public.set_project_budget(uuid, text, bigint, text), public.log_project_hours(uuid, date, numeric, text, uuid), public.project_report(uuid) from public, anon;
grant execute on function public.set_project_budget(uuid, text, bigint, text), public.log_project_hours(uuid, date, numeric, text, uuid), public.project_report(uuid) to authenticated;
