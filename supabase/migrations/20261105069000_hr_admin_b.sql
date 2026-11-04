-- M-11B (docs/research/hr-admin.md): HR administrasi lanjutan.
-- 1. Bidang kustom karyawan (tipe diperiksa database). 2. Survei dengan opsi anonim: jawaban anonim tidak menyimpan akun dan hanya
-- terbaca sebagai ringkasan setelah minimal 3 jawaban. 3. Persetujuan bertingkat untuk izin dan lembur yang diajukan staf: atasan
-- langsung dulu (atau delegasinya saat atasan izin/cuti), lalu pemilik/admin di Feed. 4. SP dan dokumen bebas (templat dengan
-- penanda) menjadi surat keluar bernomor ber-QR. Tes: supabase/tests/hr_admin_b.test.sql.

-- 1. Bidang kustom -----------------------------------------------------------------------------------------------------------
create table public.bidang_kustom (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  label text not null check (length(btrim(label)) between 2 and 60),
  tipe text not null check (tipe in ('teks', 'angka', 'tanggal', 'pilihan', 'ya_tidak')),
  pilihan text[] check (pilihan is null or cardinality(pilihan) between 2 and 20),
  staf_lihat boolean not null default false,
  urutan smallint not null default 0,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, label),
  check ((tipe = 'pilihan') = (pilihan is not null))
);
create table public.nilai_kustom (
  orang_id uuid not null references public.orang(id) on delete cascade,
  bidang_id uuid not null references public.bidang_kustom(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nilai text not null check (length(nilai) between 1 and 300),
  diubah_at timestamptz not null default now(),
  primary key (orang_id, bidang_id)
);
create index on public.nilai_kustom (perusahaan_id);
create index on public.nilai_kustom (bidang_id);
alter table public.bidang_kustom enable row level security;
alter table public.nilai_kustom enable row level security;
create policy bidang_kustom_baca on public.bidang_kustom for select to authenticated using (perusahaan_id = (select app.pid()));
create policy nilai_kustom_baca on public.nilai_kustom for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin')
    or (orang_id = (select app.orang_saya()) and bidang_id in (select b.id from public.bidang_kustom b where b.staf_lihat))));
grant select on public.bidang_kustom, public.nilai_kustom to authenticated;

create or replace function public.simpan_bidang_kustom(p_id uuid, p_label text, p_tipe text, p_pilihan text[], p_staf_lihat boolean, p_aktif boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_pil text[];
begin
  v_pil := case when p_tipe = 'pilihan' then (select array_agg(distinct btrim(x)) from unnest(p_pilihan) x where btrim(x) <> '') end;
  if p_tipe = 'pilihan' and coalesce(cardinality(v_pil), 0) < 2 then raise exception 'Bidang pilihan butuh paling sedikit 2 pilihan' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.bidang_kustom (perusahaan_id, label, tipe, pilihan, staf_lihat, urutan)
    values (v_pid, btrim(p_label), p_tipe, v_pil, coalesce(p_staf_lihat, false), (select count(*) from public.bidang_kustom where perusahaan_id = v_pid))
    returning id into v_id;
  else
    update public.bidang_kustom set label = btrim(p_label), pilihan = v_pil, staf_lihat = coalesce(p_staf_lihat, false), aktif = coalesce(p_aktif, true)
     where id = p_id and perusahaan_id = v_pid and tipe = p_tipe returning id into v_id;
    if v_id is null then raise exception 'Bidang tidak ditemukan (tipe bidang tidak bisa diganti)' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.isi_nilai_kustom(p_orang uuid, p_bidang uuid, p_nilai text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); b public.bidang_kustom; v text := btrim(coalesce(p_nilai, ''));
begin
  select * into b from public.bidang_kustom where id = p_bidang and perusahaan_id = v_pid and aktif;
  if b.id is null or not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid) then raise exception 'Bidang atau orang tidak ditemukan' using errcode = 'P0002'; end if;
  if v = '' then return; end if;  -- kosong = nilai lama tetap (isian tidak pernah menghapus data)
  if (b.tipe = 'angka' and v !~ '^-?[0-9]+([.,][0-9]+)?$')
     or (b.tipe = 'tanggal' and (v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or app.tanggal_teks(v) is null))
     or (b.tipe = 'pilihan' and not v = any(b.pilihan))
     or (b.tipe = 'ya_tidak' and v not in ('ya', 'tidak')) then
    raise exception 'Isian "%" tidak cocok dengan jenis bidang %', b.label, b.tipe using errcode = '22023';
  end if;
  insert into public.nilai_kustom (orang_id, bidang_id, perusahaan_id, nilai) values (p_orang, p_bidang, v_pid, v)
  on conflict (orang_id, bidang_id) do update set nilai = excluded.nilai, diubah_at = now();
end $$;

-- 2. Survei ------------------------------------------------------------------------------------------------------------------
create table public.survei (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 3 and 120),
  pertanyaan jsonb not null check (jsonb_typeof(pertanyaan) = 'array' and jsonb_array_length(pertanyaan) between 1 and 20),
  anonim boolean not null default true,
  untuk_peran text[] check (untuk_peran is null or untuk_peran <@ array['pemilik', 'admin', 'akuntan', 'staf']),
  tutup_tanggal date,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien)
);
-- Siapa sudah mengisi (agar tidak dua kali), terpisah dari isi jawaban. Hanya tanggal, tanpa jam, agar tidak bisa dicocokkan.
create table public.survei_isi (
  survei_id uuid not null references public.survei(id) on delete cascade,
  user_id uuid not null,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tanggal date not null,
  primary key (survei_id, user_id)
);
-- Jawaban: id acak (bukan uuid7 yang berurut waktu), akun hanya untuk survei tidak anonim.
create table public.survei_jawaban (
  id uuid primary key default gen_random_uuid(),
  survei_id uuid not null references public.survei(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  user_id uuid,
  jawaban jsonb not null check (jsonb_typeof(jawaban) = 'object' and pg_column_size(jawaban) < 16384),
  tanggal date not null
);
create index on public.survei (perusahaan_id, dibuat_at desc);
create index on public.survei_isi (perusahaan_id);
create index on public.survei_jawaban (survei_id);
create index on public.survei_jawaban (perusahaan_id);
alter table public.survei enable row level security;
alter table public.survei_isi enable row level security;
alter table public.survei_jawaban enable row level security;
create policy survei_baca on public.survei for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or untuk_peran is null or (select app.peran_aktif()) = any(untuk_peran)));
create policy survei_isi_baca on public.survei_isi for select to authenticated
  using (perusahaan_id = (select app.pid()) and user_id = (select auth.uid()));
-- Jawaban per orang hanya untuk survei tidak anonim dan hanya pengelola; survei anonim lewat ringkasan hasil_survei.
create policy survei_jawaban_baca on public.survei_jawaban for select to authenticated
  using (perusahaan_id = (select app.pid()) and user_id is not null and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.survei, public.survei_isi, public.survei_jawaban to authenticated;

create or replace function public.buat_survei(p_judul text, p_pertanyaan jsonb, p_anonim boolean, p_untuk text[], p_tutup date, p_kunci uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_q jsonb := '[]'; e jsonb; i int := 0;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select id into v_id from public.survei where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if v_id is not null then return v_id; end if;
  if jsonb_typeof(p_pertanyaan) is distinct from 'array' or jsonb_array_length(p_pertanyaan) not between 1 and 20 then
    raise exception 'Survei berisi 1 sampai 20 pertanyaan' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_pertanyaan) loop
    i := i + 1;
    if length(btrim(coalesce(e ->> 'teks', ''))) not between 3 and 200 or coalesce(e ->> 'jenis', '') not in ('skala', 'pilihan', 'teks') then
      raise exception 'Pertanyaan % butuh teks 3 sampai 200 huruf dan jenis skala, pilihan, atau teks', i using errcode = '22023';
    end if;
    if e ->> 'jenis' = 'pilihan' and (jsonb_typeof(e -> 'pilihan') is distinct from 'array' or jsonb_array_length(e -> 'pilihan') not between 2 and 10) then
      raise exception 'Pertanyaan % (pilihan) butuh 2 sampai 10 pilihan', i using errcode = '22023';
    end if;
    v_q := v_q || jsonb_build_array(jsonb_build_object('id', 'q' || i, 'teks', btrim(e ->> 'teks'), 'jenis', e ->> 'jenis',
      'pilihan', case when e ->> 'jenis' = 'pilihan' then e -> 'pilihan' end));
  end loop;
  if p_tutup is not null and p_tutup < app.hari_ini(v_pid) then raise exception 'Tanggal tutup sudah lewat' using errcode = '22023'; end if;
  insert into public.survei (perusahaan_id, judul, pertanyaan, anonim, untuk_peran, tutup_tanggal, kunci_klien, dibuat_oleh)
  values (v_pid, btrim(p_judul), v_q, coalesce(p_anonim, true), case when cardinality(p_untuk) > 0 then p_untuk end, p_tutup, p_kunci, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.isi_survei(p_survei uuid, p_jawaban jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_peran text := (select app.peran_aktif()); s public.survei; q jsonb; v jsonb; v_bersih jsonb := '{}';
begin
  if v_pid is null or v_peran is null then raise exception 'Belum masuk ke usaha' using errcode = '42501'; end if;
  select * into s from public.survei where id = p_survei and perusahaan_id = v_pid
    and (v_peran in ('pemilik', 'admin') or untuk_peran is null or v_peran = any(untuk_peran));
  if s.id is null then raise exception 'Survei tidak ditemukan' using errcode = 'P0002'; end if;
  if s.tutup_tanggal is not null and app.hari_ini(v_pid) > s.tutup_tanggal then raise exception 'Survei sudah ditutup' using errcode = '22023'; end if;
  if exists (select 1 from public.survei_isi where survei_id = s.id and user_id = auth.uid()) then raise exception 'Kamu sudah mengisi survei ini' using errcode = '23505'; end if;
  for q in select * from jsonb_array_elements(s.pertanyaan) loop
    v := p_jawaban -> (q ->> 'id');
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') then continue; end if;
    if (q ->> 'jenis' = 'skala' and (jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not in (1, 2, 3, 4, 5)))
       or (q ->> 'jenis' = 'pilihan' and not (q -> 'pilihan') @> jsonb_build_array(v))
       or (q ->> 'jenis' = 'teks' and (jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 500)) then
      raise exception 'Jawaban untuk "%" tidak sah', q ->> 'teks' using errcode = '22023';
    end if;
    v_bersih := v_bersih || jsonb_build_object(q ->> 'id', case when q ->> 'jenis' = 'teks' then to_jsonb(btrim(v #>> '{}')) else v end);
  end loop;
  if v_bersih = '{}'::jsonb then raise exception 'Isi paling sedikit satu jawaban' using errcode = '22023'; end if;
  insert into public.survei_isi (survei_id, user_id, perusahaan_id, tanggal) values (s.id, auth.uid(), v_pid, app.hari_ini(v_pid));
  insert into public.survei_jawaban (survei_id, perusahaan_id, user_id, jawaban, tanggal)
  values (s.id, v_pid, case when s.anonim then null else auth.uid() end, v_bersih, app.hari_ini(v_pid));
end $$;

-- Ringkasan untuk pengelola. Survei anonim baru dibuka setelah minimal 3 jawaban; jawaban teks diacak urutannya.
create or replace function public.hasil_survei(p_survei uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); s public.survei; n int;
begin
  select * into s from public.survei where id = p_survei and perusahaan_id = v_pid;
  if s.id is null then raise exception 'Survei tidak ditemukan' using errcode = 'P0002'; end if;
  select count(*) into n from public.survei_jawaban where survei_id = s.id;
  if s.anonim and n < 3 then return jsonb_build_object('jumlah', n, 'ditahan', true, 'pertanyaan', '[]'::jsonb); end if;
  return jsonb_build_object('jumlah', n, 'ditahan', false, 'pertanyaan', coalesce((
    select jsonb_agg(jsonb_build_object('id', q ->> 'id', 'teks', q ->> 'teks', 'jenis', q ->> 'jenis',
      'dijawab', (select count(*) from public.survei_jawaban j where j.survei_id = s.id and j.jawaban ? (q ->> 'id')),
      'rata', case when q ->> 'jenis' = 'skala' then (select round(avg((j.jawaban ->> (q ->> 'id'))::numeric), 2) from public.survei_jawaban j where j.survei_id = s.id and j.jawaban ? (q ->> 'id')) end,
      'hitung', case when q ->> 'jenis' in ('skala', 'pilihan') then (select jsonb_object_agg(k, c) from (select j.jawaban ->> (q ->> 'id') k, count(*) c from public.survei_jawaban j
                 where j.survei_id = s.id and j.jawaban ? (q ->> 'id') group by 1) h) end,
      'teks_jawaban', case when q ->> 'jenis' = 'teks' then (select jsonb_agg(t order by random()) from (select j.jawaban ->> (q ->> 'id') t from public.survei_jawaban j
                 where j.survei_id = s.id and j.jawaban ? (q ->> 'id')) x) end) order by ord)
      from jsonb_array_elements(s.pertanyaan) with ordinality as e(q, ord)), '[]'::jsonb));
end $$;

-- 3. Persetujuan bertingkat --------------------------------------------------------------------------------------------------
create table public.delegasi_persetujuan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dari_orang uuid not null references public.orang(id) on delete cascade,
  ke_orang uuid not null references public.orang(id) on delete cascade,
  mulai date not null,
  selesai date not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  check (selesai >= mulai and dari_orang <> ke_orang)
);
create index on public.delegasi_persetujuan (perusahaan_id, dari_orang, mulai, selesai);
create table public.langkah_persetujuan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  usulan_id uuid not null references public.usulan(id) on delete cascade,
  pemohon_orang uuid not null references public.orang(id) on delete cascade,
  penyetuju_orang uuid not null references public.orang(id) on delete cascade,
  penyetuju_user uuid not null,
  atas_nama_orang uuid references public.orang(id) on delete set null,
  status text not null default 'menunggu' check (status in ('menunggu', 'setuju', 'tolak')),
  catatan text check (catatan is null or length(catatan) <= 300),
  diputus_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (usulan_id)
);
create index on public.langkah_persetujuan (perusahaan_id, penyetuju_user, status);
create index on public.langkah_persetujuan (pemohon_orang);
create index on public.langkah_persetujuan (penyetuju_orang);
create index on public.langkah_persetujuan (atas_nama_orang);
create index on public.delegasi_persetujuan (ke_orang);
alter table public.delegasi_persetujuan enable row level security;
alter table public.langkah_persetujuan enable row level security;
create policy delegasi_baca on public.delegasi_persetujuan for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or (select app.orang_saya()) in (dari_orang, ke_orang)));
create policy langkah_baca on public.langkah_persetujuan for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin') or penyetuju_user = (select auth.uid()) or pemohon_orang = (select app.orang_saya())));
grant select on public.delegasi_persetujuan, public.langkah_persetujuan to authenticated;

-- Siapa menyetujui langkah atasan untuk pemohon pada tanggal itu: atasan langsung yang punya akun aktif; bila atasan sedang izin,
-- sakit, atau cuti yang disetujui, delegasinya (bila ada); bila tidak ada yang bisa, null (langsung ke pemilik/admin).
create or replace function app.penyetuju_atasan(p_pid uuid, p_pemohon uuid, p_tanggal date)
returns table (orang_id uuid, user_id uuid, atas_nama uuid)
language sql stable security definer set search_path = '' as $$
  with a as (select pk.atasan_id from public.profil_kerja pk where pk.orang_id = p_pemohon and pk.perusahaan_id = p_pid),
  absen as (select exists (select 1 from public.pengajuan_izin i, a where i.orang_id = a.atasan_id and i.status = 'disetujui'
                            and p_tanggal between i.mulai and i.selesai) as ya),
  kandidat as (
    select a.atasan_id as orang_id, null::uuid as atas_nama, 1 as urut from a, absen where not absen.ya
    union all
    select d.ke_orang, d.dari_orang, 2 from a join public.delegasi_persetujuan d on d.dari_orang = a.atasan_id and d.perusahaan_id = p_pid
     and p_tanggal between d.mulai and d.selesai
  )
  select k.orang_id, an.user_id, k.atas_nama
    from kandidat k join public.anggota an on an.orang_id = k.orang_id and an.perusahaan_id = p_pid and an.aktif and an.peran = 'staf'
   where k.orang_id <> p_pemohon
   order by k.urut limit 1
$$;

-- Usulan izin/lembur dari staf: bila ada penyetuju atasan, usulan menunggu atasan dulu (tidak tampil di Feed pemilik).
create or replace function app.rantai_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pemohon uuid; p record;
begin
  if new.status <> 'menunggu' or new.aksi not in ('izin.setujui', 'lembur.ajukan') then return new; end if;
  v_pemohon := coalesce(new.payload ->> 'orang_id', new.payload -> 'bidang' ->> 'orang_id')::uuid;
  if v_pemohon is null then return new; end if;
  select * into p from app.penyetuju_atasan(new.perusahaan_id, v_pemohon, app.hari_ini(new.perusahaan_id));
  if p.orang_id is null then return new; end if;
  new.status := 'menunggu_atasan';
  new.payload := new.payload || jsonb_build_object('rantai', jsonb_build_object('pemohon', v_pemohon, 'penyetuju', p.orang_id, 'user', p.user_id, 'atas_nama', p.atas_nama));
  return new;
end $$;
create or replace function app.rantai_langkah() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := new.payload -> 'rantai';
begin
  insert into public.langkah_persetujuan (perusahaan_id, usulan_id, pemohon_orang, penyetuju_orang, penyetuju_user, atas_nama_orang)
  values (new.perusahaan_id, new.id, (r ->> 'pemohon')::uuid, (r ->> 'penyetuju')::uuid, (r ->> 'user')::uuid, (r ->> 'atas_nama')::uuid);
  if new.aksi = 'izin.setujui' then
    update public.pengajuan_izin set alasan_putusan = 'Menunggu atasan langsung, lalu pemilik atau admin.'
     where id = (new.payload ->> 'pengajuan_id')::uuid and status = 'menunggu';
  end if;
  return new;
end $$;
create trigger rantai_usulan before insert on public.usulan for each row execute function app.rantai_usulan();
create trigger rantai_langkah after insert on public.usulan for each row when (new.status = 'menunggu_atasan') execute function app.rantai_langkah();
revoke all on function app.penyetuju_atasan(uuid, uuid, date), app.rantai_usulan(), app.rantai_langkah() from public, anon, authenticated;

create or replace function public.atur_delegasi(p_dari uuid, p_ke uuid, p_mulai date, p_selesai date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or not (coalesce((select app.peran_aktif()), '') in ('pemilik', 'admin') or p_dari = (select app.orang_saya())) then
    raise exception 'Hanya pemilik, admin, atau atasan itu sendiri yang mengatur delegasi' using errcode = '42501';
  end if;
  if (select count(*) from public.orang where id in (p_dari, p_ke) and perusahaan_id = v_pid) <> 2 then raise exception 'Orang tidak ditemukan' using errcode = 'P0002'; end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai or p_selesai > p_mulai + 90 then raise exception 'Delegasi paling lama 90 hari' using errcode = '22023'; end if;
  insert into public.delegasi_persetujuan (perusahaan_id, dari_orang, ke_orang, mulai, selesai, dibuat_oleh)
  values (v_pid, p_dari, p_ke, p_mulai, p_selesai, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Langkah yang menunggu keputusanku (atasan atau delegasinya); staf tidak bisa membaca usulan langsung, jadi lewat fungsi ini.
create or replace function public.langkah_saya() returns table (id uuid, judul text, penjelasan text, pemohon text, atas_nama text, dibuat_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, u.judul, u.penjelasan, o.nama, oa.nama, l.dibuat_at
    from public.langkah_persetujuan l join public.usulan u on u.id = l.usulan_id join public.orang o on o.id = l.pemohon_orang
    left join public.orang oa on oa.id = l.atas_nama_orang
   where l.perusahaan_id = app.pid() and l.penyetuju_user = auth.uid() and l.status = 'menunggu' and u.status = 'menunggu_atasan'
   order by l.dibuat_at
$$;

create or replace function public.putuskan_langkah(p_langkah uuid, p_setuju boolean, p_catatan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); l public.langkah_persetujuan; u public.usulan; v_nama text;
begin
  select * into l from public.langkah_persetujuan where id = p_langkah and perusahaan_id = v_pid for update;
  if l.id is null or l.penyetuju_user <> auth.uid() then raise exception 'Langkah persetujuan tidak ditemukan' using errcode = 'P0002'; end if;
  if l.status <> 'menunggu' then return jsonb_build_object('status', l.status, 'sudah', true); end if;
  select * into u from public.usulan where id = l.usulan_id for update;
  if not p_setuju and length(btrim(coalesce(p_catatan, ''))) < 3 then raise exception 'Tulis alasan menolak' using errcode = '22023'; end if;
  select nama into v_nama from public.orang where id = l.penyetuju_orang;
  update public.langkah_persetujuan set status = case when p_setuju then 'setuju' else 'tolak' end, catatan = nullif(btrim(coalesce(p_catatan, '')), ''), diputus_at = now()
   where id = l.id;
  if p_setuju then
    update public.usulan set status = 'menunggu',
           penjelasan = left(coalesce(penjelasan, '') || ' Disetujui atasan ' || v_nama || coalesce(' (atas nama ' || (select nama from public.orang where id = l.atas_nama_orang) || ')', '') || '.', 1000)
     where id = u.id and status = 'menunggu_atasan';
    if u.aksi = 'izin.setujui' then
      update public.pengajuan_izin set alasan_putusan = 'Disetujui atasan langsung, menunggu pemilik atau admin.'
       where id = (u.payload ->> 'pengajuan_id')::uuid and status = 'menunggu';
    end if;
  else
    update public.usulan set status = 'ditolak', diputuskan_at = now() where id = u.id and status = 'menunggu_atasan';
    if u.aksi = 'izin.setujui' then
      update public.pengajuan_izin set status = 'ditolak', oleh_otopilot = false, diputuskan_at = now(),
             alasan_putusan = left('Belum disetujui atasan langsung: ' || btrim(p_catatan), 300)
       where id = (u.payload ->> 'pengajuan_id')::uuid and status = 'menunggu';
    end if;
  end if;
  return jsonb_build_object('status', case when p_setuju then 'setuju' else 'tolak' end, 'sudah', false);
end $$;

-- 4. SP dan dokumen bebas sebagai surat keluar -------------------------------------------------------------------------------
alter table public.surat_keluar drop constraint surat_keluar_jenis_check;
alter table public.surat_keluar add constraint surat_keluar_jenis_check check (jenis in ('sk_mutasi', 'surat_tugas', 'keterangan_kerja', 'surat_peringatan', 'dokumen'));
alter table public.surat_peringatan add column surat_id uuid references public.surat_keluar(id) on delete set null;
create index on public.surat_peringatan (surat_id);

create or replace function public.terbitkan_surat(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); s public.surat_keluar; v_kode_nomor text; r jsonb; v_kode text;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang menerbitkan surat' using errcode = '42501';
  end if;
  select * into s from public.surat_keluar where id = p_id and perusahaan_id = v_pid for update;
  if not found then
    raise exception 'Surat tidak ditemukan' using errcode = 'P0002';
  end if;
  if s.status <> 'draf' then
    raise exception 'Surat ini sudah terbit atau dibatalkan' using errcode = '22023';
  end if;
  v_kode_nomor := case s.jenis when 'sk_mutasi' then 'SK' when 'surat_tugas' then 'ST' when 'surat_peringatan' then 'SP' when 'dokumen' then 'DOK' else 'SKK' end;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, v_kode_nomor, s.judul, '{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, v_kode_nomor, 'surat ' || s.id, auth.uid());
  v_kode := app.kode_verifikasi();
  update public.surat_keluar
     set status = 'terbit', nomor = r ->> 'nomor', nomor_terbit_id = (r ->> 'id')::uuid, tanggal = (r ->> 'tanggal')::date,
         kode_verifikasi = v_kode, terbit_at = now(), terbit_oleh = auth.uid()
   where id = s.id;
  return jsonb_build_object('id', s.id, 'nomor', r ->> 'nomor', 'kode', v_kode, 'tanggal', r ->> 'tanggal');
end $$;

-- SP menjadi surat keluar terbit (sekali per SP). Kalimat surat menyebut tingkat, pelanggaran, dasar, dan masa berlaku.
create or replace function public.terbitkan_sp(p_sp uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); s public.surat_peringatan; v_nama text; v_usaha text; v_id uuid; r jsonb; v_judul text;
begin
  select * into s from public.surat_peringatan where id = p_sp and perusahaan_id = v_pid for update;
  if s.id is null then raise exception 'Surat peringatan tidak ditemukan' using errcode = 'P0002'; end if;
  if s.surat_id is not null then
    return (select jsonb_build_object('id', id, 'nomor', nomor, 'kode', kode_verifikasi, 'sudah', true) from public.surat_keluar where id = s.surat_id);
  end if;
  select nama into v_nama from public.orang where id = s.orang_id;
  select nama into v_usaha from public.perusahaan where id = v_pid;
  v_judul := case when s.terakhir then 'Surat Peringatan Pertama dan Terakhir' else 'Surat Peringatan ' || case s.tingkat when 1 then 'Pertama' when 2 then 'Kedua' else 'Ketiga' end end;
  insert into public.surat_keluar (perusahaan_id, jenis, judul, orang_id, nama_pihak, bidang, isi, dibuat_oleh)
  values (v_pid, 'surat_peringatan', v_judul, s.orang_id, v_nama, jsonb_build_object('sp_id', s.id, 'tingkat', s.tingkat),
    jsonb_build_array(
      'Kepada ' || v_nama || '.',
      left('Dengan surat ini ' || v_usaha || ' memberikan ' || lower(v_judul) || ' kepada Anda karena: ' || s.pelanggaran || coalesce(', yang melanggar ' || s.dasar, '') || '.', 1000),
      'Surat peringatan ini berlaku sejak ' || to_char(s.tanggal, 'DD-MM-YYYY') || ' sampai ' || to_char(s.berlaku_sampai, 'DD-MM-YYYY') || '.',
      case when s.tingkat = 3 or s.terakhir
        then 'Bila pelanggaran terulang dalam masa berlaku ini, perusahaan dapat melakukan pemutusan hubungan kerja sesuai PP 35/2021 Pasal 36 huruf k dan Pasal 52.'
        else 'Bila pelanggaran terulang dalam masa berlaku ini, perusahaan dapat memberikan surat peringatan berikutnya (Penjelasan PP 35/2021 Pasal 52 ayat (1)).' end,
      'Anda dapat menyampaikan keberatan atau penjelasan kepada pemilik usaha.'),
    auth.uid())
  returning id into v_id;
  r := public.terbitkan_surat(v_id);
  update public.surat_peringatan set surat_id = v_id where id = s.id;
  return r || jsonb_build_object('sudah', false);
end $$;

-- Templat dokumen bebas (kontrak, penawaran kerja) dengan penanda {nama}, {jabatan}, {level}, {departemen}, {status}, {kontrak_sampai},
-- {mulai}, {usaha}, {tanggal}. Paragraf dipisah baris kosong. Hasilnya draf surat keluar (diterbitkan dari halaman Surat keluar).
create table public.templat_dokumen (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 3 and 80),
  judul text not null check (length(btrim(judul)) between 3 and 120),
  isi text not null check (length(isi) between 10 and 9000),
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, nama)
);
alter table public.templat_dokumen enable row level security;
create policy templat_dokumen_baca on public.templat_dokumen for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
grant select on public.templat_dokumen to authenticated;

create or replace function public.simpan_templat_dokumen(p_nama text, p_judul text, p_isi text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid; v_salah text;
begin
  select string_agg(distinct m[1], ', ') into v_salah from regexp_matches(coalesce(p_isi, '') || ' ' || coalesce(p_judul, ''), '\{([^}]*)\}', 'g') m
   where m[1] not in ('nama', 'jabatan', 'level', 'departemen', 'status', 'kontrak_sampai', 'mulai', 'usaha', 'tanggal');
  if v_salah is not null then raise exception 'Penanda tidak dikenal: %', v_salah using errcode = '22023'; end if;
  insert into public.templat_dokumen (perusahaan_id, nama, judul, isi) values (v_pid, btrim(p_nama), btrim(p_judul), btrim(p_isi))
  on conflict (perusahaan_id, nama) do update set judul = excluded.judul, isi = excluded.isi
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.buat_dokumen(p_templat uuid, p_orang uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); t public.templat_dokumen; o public.orang; pk public.profil_kerja; v_usaha text; v_isi text; v_judul text; v_par jsonb; v_id uuid;
  f text[][]; i int;
begin
  select * into t from public.templat_dokumen where id = p_templat and perusahaan_id = v_pid;
  select * into o from public.orang where id = p_orang and perusahaan_id = v_pid;
  if t.id is null or o.id is null then raise exception 'Templat atau orang tidak ditemukan' using errcode = 'P0002'; end if;
  select * into pk from public.profil_kerja where orang_id = o.id;
  select nama into v_usaha from public.perusahaan where id = v_pid;
  f := array[
    ['{nama}', o.nama], ['{jabatan}', coalesce(pk.jabatan, '-')], ['{level}', coalesce(pk.level, '-')], ['{departemen}', coalesce(pk.departemen, '-')],
    ['{status}', coalesce(case pk.status_kerja when 'pkwtt' then 'karyawan tetap (PKWTT)' when 'pkwt' then 'karyawan kontrak (PKWT)' when 'harian_lepas' then 'pekerja harian lepas'
                           when 'magang' then 'peserta magang' when 'paruh_waktu' then 'pekerja paruh waktu' end, '-')],
    ['{kontrak_sampai}', coalesce(to_char(pk.kontrak_sampai, 'DD-MM-YYYY'), '-')], ['{mulai}', coalesce(to_char(app.tanggal_teks(o.data ->> 'mulai'), 'DD-MM-YYYY'), '-')],
    ['{usaha}', v_usaha], ['{tanggal}', to_char(app.hari_ini(v_pid), 'DD-MM-YYYY')]];
  v_isi := t.isi; v_judul := t.judul;
  for i in 1 .. array_length(f, 1) loop
    v_isi := replace(v_isi, f[i][1], f[i][2]); v_judul := replace(v_judul, f[i][1], f[i][2]);
  end loop;
  select jsonb_agg(left(btrim(p), 1000)) into v_par from regexp_split_to_table(v_isi, '\n\s*\n') p where btrim(p) <> '';
  if v_par is null or jsonb_array_length(v_par) > 10 then raise exception 'Templat berisi 1 sampai 10 paragraf (pisahkan dengan baris kosong)' using errcode = '22023'; end if;
  insert into public.surat_keluar (perusahaan_id, jenis, judul, orang_id, nama_pihak, bidang, isi, dibuat_oleh)
  values (v_pid, 'dokumen', left(v_judul, 120), o.id, o.nama, jsonb_build_object('templat', t.id), v_par, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.simpan_bidang_kustom(uuid, text, text, text[], boolean, boolean), public.isi_nilai_kustom(uuid, uuid, text),
  public.buat_survei(text, jsonb, boolean, text[], date, uuid), public.isi_survei(uuid, jsonb), public.hasil_survei(uuid),
  public.atur_delegasi(uuid, uuid, date, date), public.langkah_saya(), public.putuskan_langkah(uuid, boolean, text),
  public.terbitkan_sp(uuid), public.simpan_templat_dokumen(text, text, text), public.buat_dokumen(uuid, uuid) from public, anon;
grant execute on function public.simpan_bidang_kustom(uuid, text, text, text[], boolean, boolean), public.isi_nilai_kustom(uuid, uuid, text),
  public.buat_survei(text, jsonb, boolean, text[], date, uuid), public.isi_survei(uuid, jsonb), public.hasil_survei(uuid),
  public.atur_delegasi(uuid, uuid, date, date), public.langkah_saya(), public.putuskan_langkah(uuid, boolean, text),
  public.terbitkan_sp(uuid), public.simpan_templat_dokumen(text, text, text), public.buat_dokumen(uuid, uuid) to authenticated;
