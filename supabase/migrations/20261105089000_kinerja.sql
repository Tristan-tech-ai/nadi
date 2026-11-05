-- M-13 kinerja: tujuan (goal) per orang, siklus review (diri, atasan, rekan) dengan skor 1-5 per kompetensi, kalibrasi oleh pemilik/admin
-- menjadi skor akhir + potensi = kotak 9-box, dan rencana pengembangan (IDP). Kerahasiaan: nilai orang lain hanya dilihat pemilik/admin
-- dan atasan langsung (profil_kerja.atasan_id); yang dinilai tidak melihat skor dari penilai lain; penilai rekan hanya muncul sebagai
-- rata-rata bila paling sedikit 2 rekan sudah mengisi. Semua tulis lewat RPC.

create table public.perf_goal (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 160),
  target numeric check (target is null or target > 0),
  satuan text check (satuan is null or length(satuan) <= 30),
  progres numeric not null default 0 check (progres >= 0),
  mulai date not null,
  selesai date not null check (selesai >= mulai),
  status text not null default 'aktif' check (status in ('aktif', 'tercapai', 'batal')),
  dibuat_oleh uuid,
  diubah_at timestamptz not null default now()
);
create index perf_goal_orang on public.perf_goal (perusahaan_id, orang_id);

create table public.review_cycle (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 3 and 80),
  mulai date not null,
  selesai date not null check (selesai >= mulai),
  kompetensi text[] not null check (array_length(kompetensi, 1) between 1 and 10),
  status text not null default 'buka' check (status in ('buka', 'selesai')),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);

create table public.review_entry (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  cycle_id uuid not null references public.review_cycle(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  penilai_id uuid not null references public.orang(id) on delete cascade,
  peran text not null check (peran in ('diri', 'atasan', 'rekan')),
  skor jsonb,
  komentar text check (komentar is null or length(komentar) <= 1000),
  dikirim_at timestamptz,
  unique (cycle_id, orang_id, penilai_id)
);

create table public.review_result (
  cycle_id uuid not null references public.review_cycle(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  skor_akhir numeric(3,2) not null check (skor_akhir between 1 and 5),
  potensi integer not null check (potensi between 1 and 3),
  kotak text not null check (kotak ~ '^k[1-3]p[1-3]$'),
  catatan text check (catatan is null or length(catatan) <= 500),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  primary key (cycle_id, orang_id)
);

create table public.idp_item (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  tujuan text not null check (length(btrim(tujuan)) between 3 and 200),
  langkah text check (langkah is null or length(langkah) <= 500),
  target date,
  status text not null default 'rencana' check (status in ('rencana', 'jalan', 'selesai')),
  dibuat_oleh uuid,
  diubah_at timestamptz not null default now()
);

-- Boleh melihat data kinerja orang p_orang: pemilik/admin, atasan langsungnya, atau dirinya sendiri (p_diri).
create or replace function app.boleh_kinerja(p_orang uuid, p_diri boolean default true) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.peran_aktif() in ('pemilik', 'admin'), false)
      or exists (select 1 from public.profil_kerja pk where pk.orang_id = p_orang and pk.atasan_id = app.orang_saya() and pk.perusahaan_id = app.pid())
      or (p_diri and p_orang = app.orang_saya())
$$;
revoke all on function app.boleh_kinerja(uuid, boolean) from public, anon;
grant execute on function app.boleh_kinerja(uuid, boolean) to authenticated;

alter table public.perf_goal enable row level security;
alter table public.review_cycle enable row level security;
alter table public.review_entry enable row level security;
alter table public.review_result enable row level security;
alter table public.idp_item enable row level security;
create policy perf_goal_baca on public.perf_goal for select to authenticated using (perusahaan_id = (select app.pid()) and app.boleh_kinerja(orang_id));
create policy idp_item_baca on public.idp_item for select to authenticated using (perusahaan_id = (select app.pid()) and app.boleh_kinerja(orang_id));
create policy review_cycle_baca on public.review_cycle for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
-- Isian review: penilainya sendiri, atau pemilik/admin/atasan orang yang dinilai (bukan orang yang dinilai).
create policy review_entry_baca on public.review_entry for select to authenticated
  using (perusahaan_id = (select app.pid()) and (penilai_id = (select app.orang_saya()) or app.boleh_kinerja(orang_id, false)));
create policy review_result_baca on public.review_result for select to authenticated using (perusahaan_id = (select app.pid()) and app.boleh_kinerja(orang_id, false));
grant select on public.perf_goal, public.review_cycle, public.review_entry, public.review_result, public.idp_item to authenticated;

create or replace function app.kotak9(p_skor numeric, p_potensi integer) returns text
language sql immutable set search_path = '' as $$
  select 'k' || case when p_skor >= 4 then 3 when p_skor >= 3 then 2 else 1 end || 'p' || p_potensi
$$;

-- Tujuan: pemilik/admin/atasan untuk orangnya, atau orang itu untuk dirinya sendiri.
create or replace function public.save_goal(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_orang uuid := (p ->> 'orang')::uuid; v_id uuid := nullif(p ->> 'id', '')::uuid; g public.perf_goal;
begin
  if v_pid is null or not (select app.anggota_aktif()) then raise exception 'Masuk sebagai anggota usaha ini dulu' using errcode = '42501'; end if;
  if v_id is not null then
    select * into g from public.perf_goal where id = v_id and perusahaan_id = v_pid;
    if not found then raise exception 'Tujuan tidak ditemukan' using errcode = 'P0002'; end if;
    v_orang := g.orang_id;
  end if;
  if v_orang is null or not exists (select 1 from public.orang where id = v_orang and perusahaan_id = v_pid) then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if not app.boleh_kinerja(v_orang) then raise exception 'Hanya orangnya, atasannya, atau pemilik yang mengatur tujuan ini' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.perf_goal (perusahaan_id, orang_id, judul, target, satuan, mulai, selesai, dibuat_oleh)
    values (v_pid, v_orang, btrim(p ->> 'judul'), nullif(p ->> 'target', '')::numeric, nullif(btrim(coalesce(p ->> 'satuan', '')), ''),
            (p ->> 'mulai')::date, (p ->> 'selesai')::date, auth.uid()) returning id into v_id;
  else
    update public.perf_goal set progres = coalesce(nullif(p ->> 'progres', '')::numeric, progres), status = coalesce(nullif(p ->> 'status', ''), status), diubah_at = now()
     where id = v_id;
  end if;
  return v_id;
end $$;

-- Siklus review: penilaian diri untuk setiap peserta dan penilaian atasan bila profil kerja punya atasan.
create or replace function public.create_review_cycle(p_nama text, p_mulai date, p_selesai date, p_kompetensi text[], p_peserta uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; o uuid; v_atasan uuid;
begin
  if coalesce(array_length(p_peserta, 1), 0) = 0 then raise exception 'Pilih minimal satu peserta' using errcode = '22023'; end if;
  insert into public.review_cycle (perusahaan_id, nama, mulai, selesai, kompetensi, dibuat_oleh)
  values (v_pid, btrim(p_nama), p_mulai, p_selesai, (select array_agg(btrim(k)) from unnest(p_kompetensi) k where btrim(k) <> ''), auth.uid()) returning id into v_id;
  foreach o in array p_peserta loop
    if not exists (select 1 from public.orang where id = o and perusahaan_id = v_pid) then raise exception 'Peserta tidak ditemukan' using errcode = 'P0002'; end if;
    insert into public.review_entry (perusahaan_id, cycle_id, orang_id, penilai_id, peran) values (v_pid, v_id, o, o, 'diri') on conflict do nothing;
    select atasan_id into v_atasan from public.profil_kerja where orang_id = o and perusahaan_id = v_pid;
    if v_atasan is not null then
      insert into public.review_entry (perusahaan_id, cycle_id, orang_id, penilai_id, peran) values (v_pid, v_id, o, v_atasan, 'atasan') on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.add_peer_reviewer(p_cycle uuid, p_orang uuid, p_rekan uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid;
begin
  if p_orang = p_rekan then raise exception 'Rekan tidak boleh orang yang dinilai' using errcode = '22023'; end if;
  if not exists (select 1 from public.review_cycle where id = p_cycle and perusahaan_id = v_pid and status = 'buka') then raise exception 'Siklus tidak ditemukan atau sudah selesai' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.orang where id = p_rekan and perusahaan_id = v_pid) then raise exception 'Rekan tidak ditemukan' using errcode = 'P0002'; end if;
  insert into public.review_entry (perusahaan_id, cycle_id, orang_id, penilai_id, peran) values (v_pid, p_cycle, p_orang, p_rekan, 'rekan')
  on conflict (cycle_id, orang_id, penilai_id) do nothing returning id into v_id;
  return v_id;
end $$;

-- Hanya penilainya sendiri yang mengisi, selama siklus buka. Skor wajib untuk setiap kompetensi siklus, bilangan bulat 1-5.
create or replace function public.submit_review(p_entry uuid, p_skor jsonb, p_komentar text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); e public.review_entry; c public.review_cycle; k text; v jsonb := '{}';
begin
  select * into e from public.review_entry where id = p_entry and perusahaan_id = v_pid for update;
  if not found then raise exception 'Isian review tidak ditemukan' using errcode = 'P0002'; end if;
  if e.penilai_id is distinct from app.orang_saya() then raise exception 'Hanya penilainya yang mengisi review ini' using errcode = '42501'; end if;
  select * into c from public.review_cycle where id = e.cycle_id;
  if c.status <> 'buka' then raise exception 'Siklus review sudah ditutup' using errcode = '22023'; end if;
  foreach k in array c.kompetensi loop
    if coalesce(p_skor ->> k, '') !~ '^[1-5]$' then raise exception 'Isi skor 1 sampai 5 untuk %', k using errcode = '22023'; end if;
    v := v || jsonb_build_object(k, (p_skor ->> k)::int);
  end loop;
  update public.review_entry set skor = v, komentar = nullif(left(btrim(coalesce(p_komentar, '')), 1000), ''), dikirim_at = now() where id = e.id;
end $$;

create or replace function app.rata_skor(p_skor jsonb) returns numeric
language sql immutable set search_path = '' as $$ select avg(v::numeric) from jsonb_each_text(p_skor) x(k, v) $$;

-- Ringkasan siklus: rata-rata diri, atasan, rekan (rekan hanya bila >= 2 rekan mengisi), skor usulan (atasan 60%, diri 20%, rekan 20%,
-- bobot dibagi ulang bila ada yang kosong), hasil kalibrasi. Pemilik/admin melihat semua; atasan hanya bawahan langsungnya.
create or replace function public.review_summary(p_cycle uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or not exists (select 1 from public.review_cycle where id = p_cycle and perusahaan_id = v_pid) then raise exception 'Siklus tidak ditemukan' using errcode = 'P0002'; end if;
  return coalesce((with per as (
      select e.orang_id,
             avg(app.rata_skor(e.skor)) filter (where e.peran = 'diri' and e.dikirim_at is not null) diri,
             avg(app.rata_skor(e.skor)) filter (where e.peran = 'atasan' and e.dikirim_at is not null) atasan,
             case when count(*) filter (where e.peran = 'rekan' and e.dikirim_at is not null) >= 2
                  then avg(app.rata_skor(e.skor)) filter (where e.peran = 'rekan' and e.dikirim_at is not null) end rekan,
             count(*) filter (where e.dikirim_at is not null) masuk, count(*) total
        from public.review_entry e where e.cycle_id = p_cycle and app.boleh_kinerja(e.orang_id, false) group by e.orang_id)
    select jsonb_agg(jsonb_build_object('orang', p.orang_id, 'nama', o.nama, 'diri', round(p.diri, 2), 'atasan', round(p.atasan, 2), 'rekan', round(p.rekan, 2),
             'usulan', round((coalesce(p.atasan * 0.6, 0) + coalesce(p.diri * 0.2, 0) + coalesce(p.rekan * 0.2, 0))
                       / nullif((case when p.atasan is null then 0 else 0.6 end) + (case when p.diri is null then 0 else 0.2 end) + (case when p.rekan is null then 0 else 0.2 end), 0), 2),
             'masuk', p.masuk, 'total', p.total, 'skor_akhir', r.skor_akhir, 'potensi', r.potensi, 'kotak', r.kotak, 'catatan', r.catatan) order by o.nama)
      from per p join public.orang o on o.id = p.orang_id left join public.review_result r on r.cycle_id = p_cycle and r.orang_id = p.orang_id), '[]');
end $$;

-- Kalibrasi oleh pemilik/admin: skor akhir (bawaan = usulan) dan potensi 1-3 menjadi kotak 9-box.
create or replace function public.calibrate_review(p_cycle uuid, p_orang uuid, p_skor numeric, p_potensi integer, p_catatan text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_skor numeric := p_skor; v_kotak text;
begin
  if not exists (select 1 from public.review_entry where cycle_id = p_cycle and orang_id = p_orang and perusahaan_id = v_pid) then
    raise exception 'Orang ini bukan peserta siklus' using errcode = 'P0002';
  end if;
  if v_skor is null then
    select (x ->> 'usulan')::numeric into v_skor from jsonb_array_elements(public.review_summary(p_cycle)) x where (x ->> 'orang')::uuid = p_orang;
  end if;
  if v_skor is null or v_skor < 1 or v_skor > 5 then raise exception 'Skor akhir 1 sampai 5 (belum ada review yang masuk?)' using errcode = '22023'; end if;
  if p_potensi not between 1 and 3 then raise exception 'Potensi 1 (rendah), 2 (sedang), atau 3 (tinggi)' using errcode = '22023'; end if;
  v_kotak := app.kotak9(v_skor, p_potensi);
  insert into public.review_result (cycle_id, orang_id, perusahaan_id, skor_akhir, potensi, kotak, catatan, diubah_oleh)
  values (p_cycle, p_orang, v_pid, round(v_skor, 2), p_potensi, v_kotak, nullif(left(btrim(coalesce(p_catatan, '')), 500), ''), auth.uid())
  on conflict (cycle_id, orang_id) do update set skor_akhir = excluded.skor_akhir, potensi = excluded.potensi, kotak = excluded.kotak, catatan = excluded.catatan,
    diubah_oleh = excluded.diubah_oleh, diubah_at = now();
  return v_kotak;
end $$;

create or replace function public.close_review_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  update public.review_cycle set status = 'selesai' where id = p_cycle and perusahaan_id = v_pid and status = 'buka';
  if not found then raise exception 'Siklus tidak ditemukan atau sudah selesai' using errcode = 'P0002'; end if;
end $$;

create or replace function public.save_idp_item(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid := nullif(p ->> 'id', '')::uuid; v_orang uuid := (p ->> 'orang')::uuid; i public.idp_item;
begin
  if v_pid is null or not (select app.anggota_aktif()) then raise exception 'Masuk sebagai anggota usaha ini dulu' using errcode = '42501'; end if;
  if v_id is not null then
    select * into i from public.idp_item where id = v_id and perusahaan_id = v_pid;
    if not found then raise exception 'Rencana tidak ditemukan' using errcode = 'P0002'; end if;
    v_orang := i.orang_id;
  end if;
  if v_orang is null or not app.boleh_kinerja(v_orang) then raise exception 'Hanya orangnya, atasannya, atau pemilik yang mengatur rencana ini' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.idp_item (perusahaan_id, orang_id, tujuan, langkah, target, dibuat_oleh)
    values (v_pid, v_orang, btrim(p ->> 'tujuan'), nullif(btrim(coalesce(p ->> 'langkah', '')), ''), nullif(p ->> 'target', '')::date, auth.uid()) returning id into v_id;
  else
    update public.idp_item set status = coalesce(nullif(p ->> 'status', ''), status), diubah_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

revoke all on function app.kotak9(numeric, integer), app.rata_skor(jsonb) from public, anon, authenticated;
revoke all on function public.save_goal(jsonb), public.create_review_cycle(text, date, date, text[], uuid[]), public.add_peer_reviewer(uuid, uuid, uuid),
  public.submit_review(uuid, jsonb, text), public.review_summary(uuid), public.calibrate_review(uuid, uuid, numeric, integer, text), public.close_review_cycle(uuid),
  public.save_idp_item(jsonb) from public, anon;
grant execute on function public.save_goal(jsonb), public.create_review_cycle(text, date, date, text[], uuid[]), public.add_peer_reviewer(uuid, uuid, uuid),
  public.submit_review(uuid, jsonb, text), public.review_summary(uuid), public.calibrate_review(uuid, uuid, numeric, integer, text), public.close_review_cycle(uuid),
  public.save_idp_item(jsonb) to authenticated;
