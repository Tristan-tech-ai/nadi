-- F4-01 Nomor Sakti (docs/research/nomor-sakti.md, rencana uji docs/quality/rencana-uji-f4-01.md).
-- Nomor dokumen tanpa ganda dan tanpa loncat. Bukan sequence: dokumentasi PostgreSQL (functions-sequence) menyatakan nilai
-- nextval tidak dikembalikan saat transaksi batal sehingga sequence tidak bisa dipakai untuk nomor tanpa celah. Penghitung disimpan
-- di tabel biasa app.penomor dan dinaikkan dengan INSERT ... ON CONFLICT DO UPDATE ... RETURNING di transaksi yang sama dengan
-- pencatatan nomor: kunci baris membuat permintaan bersamaan antre (bukan ganda), transaksi batal ikut membatalkan kenaikan (bukan
-- loncat). Nomor yang dibatalkan tetap tercatat (status batal + alasan) dan tidak dipakai ulang.
-- Tata bahasa templat: {no} atau {no:N} (urut, N digit dengan nol di depan), {kode} (kode usaha di templat, cadangan
-- perusahaan.kode), {jenis} (kode jenis dokumen), {bulan_romawi}, {bulan} (2 digit), {tahun} (4 digit), {tahun2}.
-- Periode reset diturunkan dari token: ada {bulan}/{bulan_romawi} = bulanan, ada {tahun}/{tahun2} saja = tahunan, tanpa token
-- waktu = tidak pernah. Tanggal dan periode dihitung di zona usaha (app.hari_ini, Q-24/Q-26).
-- Hak lewat app.peran_aktif() (tabel anggota, bukan klaim JWT; Q-21/Q-23): atur templat pemilik/admin; ambil nomor
-- pemilik/admin/akuntan; batal pemilik/admin.

create table public.templat_nomor (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis ~ '^[A-Z][A-Z0-9]{0,9}$'),
  nama text not null check (length(btrim(nama)) between 1 and 80),
  templat text not null check (length(templat) between 4 and 120 and templat ~ '\{no(:[1-9])?\}'),
  kode_usaha text check (kode_usaha is null or kode_usaha ~ '^[A-Z0-9]{2,10}$'),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, jenis)
);

create table app.penomor (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null,
  periode text not null,
  terakhir integer not null check (terakhir >= 1),
  primary key (perusahaan_id, jenis, periode)
);

create table public.nomor_terbit (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null,
  periode text not null,
  urut integer not null check (urut >= 1),
  nomor text not null,
  tanggal date not null,
  status text not null default 'terbit' check (status in ('terbit', 'batal')),
  alasan_batal text,
  dokumen_ref text check (dokumen_ref is null or length(dokumen_ref) <= 200),
  dibuat_oleh uuid not null,
  dibuat_at timestamptz not null default now(),
  dibatalkan_oleh uuid,
  dibatalkan_at timestamptz,
  unique (perusahaan_id, jenis, periode, urut),
  unique (perusahaan_id, nomor),
  check ((status = 'batal') = (alasan_batal is not null))
);
create index on public.nomor_terbit (perusahaan_id, dibuat_at desc);

alter table public.templat_nomor enable row level security;
alter table public.nomor_terbit enable row level security;
create policy templat_nomor_baca on public.templat_nomor for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy nomor_terbit_baca on public.nomor_terbit for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.templat_nomor, public.nomor_terbit to authenticated;

create trigger audit_templat_nomor after insert or update or delete on public.templat_nomor for each row execute function app.catat_audit();
create trigger audit_nomor_terbit after insert or update or delete on public.nomor_terbit for each row execute function app.catat_audit();

create or replace function app.romawi(p integer) returns text
language sql immutable set search_path = '' as $$
  select (array['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'])[p]
$$;

create or replace function app.periode_nomor(p_templat text, p_tanggal date) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_templat ~ '\{(bulan|bulan_romawi)\}' then to_char(p_tanggal, 'YYYY-MM')
    when p_templat ~ '\{(tahun|tahun2)\}' then to_char(p_tanggal, 'YYYY')
    else 'selamanya'
  end
$$;

create or replace function app.susun_nomor(p_templat text, p_urut integer, p_kode text, p_jenis text, p_tanggal date) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := p_templat; m text[];
begin
  -- {no:N}: N digit dengan nol di depan; {no}: tanpa nol.
  loop
    m := regexp_match(v, '\{no:([1-9])\}');
    exit when m is null;
    v := regexp_replace(v, '\{no:' || m[1] || '\}', lpad(p_urut::text, m[1]::int, '0'));
  end loop;
  v := replace(v, '{no}', p_urut::text);
  v := replace(v, '{kode}', coalesce(p_kode, ''));
  v := replace(v, '{jenis}', p_jenis);
  v := replace(v, '{bulan_romawi}', app.romawi(extract(month from p_tanggal)::int));
  v := replace(v, '{bulan}', to_char(p_tanggal, 'MM'));
  v := replace(v, '{tahun2}', to_char(p_tanggal, 'YY'));
  v := replace(v, '{tahun}', to_char(p_tanggal, 'YYYY'));
  return v;
end $$;

create or replace function public.atur_templat_nomor(p_jenis text, p_nama text, p_templat text, p_kode_usaha text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengatur penomoran dokumen' using errcode = '42501';
  end if;
  if p_templat ~ '\{[^}]*\}' and regexp_replace(p_templat, '\{(no(:[1-9])?|kode|jenis|bulan_romawi|bulan|tahun2|tahun)\}', '', 'g') ~ '[{}]' then
    raise exception 'Templat memuat token yang tidak dikenal. Pakai {no:3}, {kode}, {jenis}, {bulan_romawi}, {bulan}, {tahun}, atau {tahun2}' using errcode = '22023';
  end if;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat, kode_usaha)
  values (v_pid, upper(btrim(p_jenis)), btrim(p_nama), p_templat, nullif(upper(btrim(coalesce(p_kode_usaha, ''))), ''))
  on conflict (perusahaan_id, jenis) do update
    set nama = excluded.nama, templat = excluded.templat, kode_usaha = excluded.kode_usaha, aktif = true, diubah_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.ambil_nomor(p_jenis text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); t public.templat_nomor; v_tgl date; v_periode text; v_urut integer; v_kode text; v_nomor text; v_id uuid;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang mengambil nomor dokumen' using errcode = '42501';
  end if;
  select * into t from public.templat_nomor where perusahaan_id = v_pid and jenis = upper(btrim(p_jenis)) and aktif;
  if not found then
    raise exception 'Penomoran untuk jenis % belum diatur', upper(btrim(p_jenis)) using errcode = 'P0002';
  end if;
  v_tgl := app.hari_ini(v_pid);
  v_periode := app.periode_nomor(t.templat, v_tgl);
  insert into app.penomor (perusahaan_id, jenis, periode, terakhir) values (v_pid, t.jenis, v_periode, 1)
  on conflict (perusahaan_id, jenis, periode) do update set terakhir = app.penomor.terakhir + 1
  returning terakhir into v_urut;
  select coalesce(t.kode_usaha, p.kode) into v_kode from public.perusahaan p where p.id = v_pid;
  v_nomor := app.susun_nomor(t.templat, v_urut, v_kode, t.jenis, v_tgl);
  insert into public.nomor_terbit (perusahaan_id, jenis, periode, urut, nomor, tanggal, dokumen_ref, dibuat_oleh)
  values (v_pid, t.jenis, v_periode, v_urut, v_nomor, v_tgl, nullif(btrim(coalesce(p_ref, '')), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nomor', v_nomor, 'urut', v_urut, 'periode', v_periode, 'tanggal', v_tgl);
end $$;

create or replace function public.batal_nomor(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); r public.nomor_terbit;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang membatalkan nomor' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan pembatalan nomor' using errcode = '22023';
  end if;
  update public.nomor_terbit
     set status = 'batal', alasan_batal = btrim(p_alasan), dibatalkan_oleh = auth.uid(), dibatalkan_at = now()
   where id = p_id and perusahaan_id = v_pid and status = 'terbit'
  returning * into r;
  if not found then
    raise exception 'Nomor tidak ditemukan atau sudah dibatalkan' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', r.id, 'nomor', r.nomor, 'status', r.status);
end $$;

revoke all on function app.romawi(integer), app.periode_nomor(text, date), app.susun_nomor(text, integer, text, text, date)
  from public, anon, authenticated;
revoke all on table app.penomor from public, anon, authenticated;
revoke all on function public.atur_templat_nomor(text, text, text, text), public.ambil_nomor(text, text), public.batal_nomor(uuid, text)
  from public, anon;
grant execute on function public.atur_templat_nomor(text, text, text, text), public.ambil_nomor(text, text), public.batal_nomor(uuid, text)
  to authenticated;
