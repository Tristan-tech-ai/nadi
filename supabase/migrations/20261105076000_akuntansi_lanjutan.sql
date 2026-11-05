-- M-08 akuntansi lanjutan (docs/research/mekari/rencana.md; menutup JU-19..JU-22, JU-27, EX-08; tes supabase/tests/akuntansi_lanjutan.test.sql):
--   1. anggaran per akun per bulan + laporan anggaran vs realisasi;
--   2. dimensi (cabang, proyek) di tingkat jurnal, aturan tag dari kata di keterangan, laba rugi per dimensi;
--   3. jurnal berulang (bulanan/mingguan), dijalankan harian oleh pg_cron dan bisa dijalankan manual, idempoten per tanggal;
--   4. kurs: kurs pajak resmi bersama (KMK Menteri Keuangan, mingguan) + kurs isian usaha, untuk kalkulator kurs;
--   5. revaluasi piutang valas invoice ekspor di akhir periode + selisih kurs saat pelunasan (4-920 laba / 6-920 rugi selisih kurs);
--   6. konsolidasi beberapa usaha milik pemilik yang sama; jurnal antarusaha (1-250/2-250) dieliminasi.
-- Nama teknis baru berbahasa Inggris (I-04); teks yang dilihat pengguna tetap bahasa Indonesia.

create or replace function app.ensure_account(p_pid uuid, p_kode text, p_nama text, p_golongan text, p_normal text) returns void
language sql security definer set search_path = '' as $$
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (p_pid, p_kode, p_nama, p_golongan, p_normal, true)
  on conflict (perusahaan_id, kode) do nothing
$$;

-- ---------- 1. Anggaran ----------
create table public.budget (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  akun_id uuid not null references public.akun(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  nominal bigint not null check (nominal between 0 and 1000000000000),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, akun_id, bulan)
);
alter table public.budget enable row level security;
create policy budget_baca on public.budget for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.budget to authenticated;
create trigger audit_budget after insert or update or delete on public.budget for each row execute function app.catat_audit();

-- Nominal yang sama untuk bulan p_bulan sampai p_sampai (paling banyak 24 bulan). 0 = tanpa anggaran.
create or replace function public.set_budget(p_kode text, p_bulan date, p_nominal bigint, p_sampai date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); a public.akun; v_awal date := date_trunc('month', p_bulan)::date;
  v_akhir date := date_trunc('month', coalesce(p_sampai, p_bulan))::date; n int;
begin
  select * into a from public.akun where perusahaan_id = v_pid and kode = p_kode and aktif;
  if not found then raise exception 'Akun % tidak ada di bagan akun usaha ini', p_kode using errcode = 'P0002'; end if;
  if a.golongan not in ('pendapatan', 'beban') then
    raise exception 'Anggaran hanya untuk akun pendapatan atau beban' using errcode = '22023';
  end if;
  if p_nominal is null or p_nominal < 0 or p_nominal > 1000000000000 then
    raise exception 'Isi anggaran dalam rupiah, 0 sampai 1 triliun' using errcode = '22023';
  end if;
  if v_awal is null or v_akhir < v_awal or v_akhir > (v_awal + interval '23 months')::date then
    raise exception 'Rentang bulan anggaran 1 sampai 24 bulan' using errcode = '22023';
  end if;
  insert into public.budget (perusahaan_id, akun_id, bulan, nominal, diubah_oleh)
  select v_pid, a.id, g::date, p_nominal, auth.uid() from generate_series(v_awal, v_akhir, interval '1 month') g
  on conflict (perusahaan_id, akun_id, bulan) do update set nominal = excluded.nominal, diubah_oleh = excluded.diubah_oleh, diubah_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- 2. Dimensi ----------
create table public.dimension (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('cabang', 'proyek')),
  nama text not null check (length(btrim(nama)) between 2 and 60),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, jenis, nama),
  unique (perusahaan_id, id)
);
create table public.journal_tag (
  perusahaan_id uuid not null,
  jurnal_id uuid not null,
  jenis text not null check (jenis in ('cabang', 'proyek')),
  dimension_id uuid not null,
  sumber text not null default 'manual' check (sumber in ('manual', 'aturan', 'berulang')),
  diubah_at timestamptz not null default now(),
  primary key (jurnal_id, jenis),
  foreign key (perusahaan_id, jurnal_id) references public.jurnal (perusahaan_id, id),
  foreign key (perusahaan_id, dimension_id) references public.dimension (perusahaan_id, id)
);
create index on public.journal_tag (perusahaan_id, dimension_id);
create table public.tag_rule (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  dimension_id uuid not null,
  kata text not null check (length(btrim(kata)) between 2 and 60),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, dimension_id, kata),
  foreign key (perusahaan_id, dimension_id) references public.dimension (perusahaan_id, id)
);
alter table public.dimension enable row level security;
alter table public.journal_tag enable row level security;
alter table public.tag_rule enable row level security;
create policy dimension_baca on public.dimension for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy journal_tag_baca on public.journal_tag for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy tag_rule_baca on public.tag_rule for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.dimension, public.journal_tag, public.tag_rule to authenticated;

create or replace function public.save_dimension(p_jenis text, p_nama text, p_aktif boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); v_id uuid;
begin
  if p_jenis not in ('cabang', 'proyek') then raise exception 'Jenis dimensi: cabang atau proyek' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 60 then raise exception 'Nama cabang atau proyek 2 sampai 60 huruf' using errcode = '22023'; end if;
  insert into public.dimension (perusahaan_id, jenis, nama, aktif) values (v_pid, p_jenis, btrim(p_nama), coalesce(p_aktif, true))
  on conflict (perusahaan_id, jenis, nama) do update set aktif = excluded.aktif
  returning id into v_id;
  return v_id;
end $$;

-- Tag manual (menimpa tag jenis yang sama). Tag adalah analisis, bukan isi jurnal: jurnal sendiri tetap tidak bisa diubah.
create or replace function public.tag_journal(p_jurnal uuid, p_dimension uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); d public.dimension;
begin
  select * into d from public.dimension where id = p_dimension and perusahaan_id = v_pid and aktif;
  if not found then raise exception 'Cabang atau proyek tidak ditemukan' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.jurnal where id = p_jurnal and perusahaan_id = v_pid) then
    raise exception 'Jurnal tidak ditemukan' using errcode = 'P0002';
  end if;
  insert into public.journal_tag (perusahaan_id, jurnal_id, jenis, dimension_id, sumber) values (v_pid, p_jurnal, d.jenis, d.id, 'manual')
  on conflict (jurnal_id, jenis) do update set dimension_id = excluded.dimension_id, sumber = 'manual', diubah_at = now();
end $$;

create or replace function public.save_tag_rule(p_dimension uuid, p_kata text, p_aktif boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); v_id uuid;
begin
  if not exists (select 1 from public.dimension where id = p_dimension and perusahaan_id = v_pid) then
    raise exception 'Cabang atau proyek tidak ditemukan' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_kata, ''))) not between 2 and 60 then raise exception 'Kata aturan 2 sampai 60 huruf' using errcode = '22023'; end if;
  insert into public.tag_rule (perusahaan_id, dimension_id, kata, aktif) values (v_pid, p_dimension, lower(btrim(p_kata)), coalesce(p_aktif, true))
  on conflict (perusahaan_id, dimension_id, kata) do update set aktif = excluded.aktif
  returning id into v_id;
  return v_id;
end $$;

-- Aturan tag pada satu jurnal: kata terpanjang yang muncul di keterangan menang, satu tag per jenis, tag manual tidak ditimpa.
create or replace function app.apply_tag_rules_to(p_pid uuid, p_jurnal uuid, p_keterangan text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.journal_tag (perusahaan_id, jurnal_id, jenis, dimension_id, sumber)
  select distinct on (d.jenis) p_pid, p_jurnal, d.jenis, d.id, 'aturan'
    from public.tag_rule r join public.dimension d on d.id = r.dimension_id and d.aktif
   where r.perusahaan_id = p_pid and r.aktif and strpos(lower(p_keterangan), r.kata) > 0
   order by d.jenis, length(r.kata) desc, r.dibuat_at
  on conflict (jurnal_id, jenis) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function app.tag_jurnal_baru() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.tag_rule r where r.perusahaan_id = new.perusahaan_id and r.aktif) then
    perform app.apply_tag_rules_to(new.perusahaan_id, new.id, new.keterangan);
  end if;
  return null;
end $$;
create trigger tag_jurnal_baru after insert on public.jurnal for each row execute function app.tag_jurnal_baru();

-- Terapkan aturan ke jurnal lama yang belum bertag dalam rentang tanggal.
create or replace function public.apply_tag_rules(p_dari date, p_sampai date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); j record; n int := 0;
begin
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  for j in select id, keterangan from public.jurnal where perusahaan_id = v_pid and tanggal between p_dari and p_sampai loop
    n := n + app.apply_tag_rules_to(v_pid, j.id, j.keterangan);
  end loop;
  return n;
end $$;

-- Gerak pendapatan/beban per akun dalam rentang, opsional hanya jurnal bertag dimensi tertentu (tanpa jurnal tutup buku).
create or replace function app.gerak_lr(p_pid uuid, p_dari date, p_sampai date, p_dimension uuid default null)
returns table (kode text, nama text, golongan text, nilai bigint)
language sql stable security definer set search_path = '' as $$
  select a.kode, a.nama, a.golongan,
         coalesce(sum(case when a.golongan = 'beban' then b.debit - b.kredit else b.kredit - b.debit end), 0)::bigint
    from public.jurnal_baris b
    join public.jurnal j on j.id = b.jurnal_id and j.perusahaan_id = p_pid
    join public.akun a on a.id = b.akun_id
   where b.perusahaan_id = p_pid and j.tanggal between p_dari and p_sampai and j.sumber <> 'tutup_buku'
     and a.golongan in ('pendapatan', 'beban')
     and (p_dimension is null or exists (select 1 from public.journal_tag t where t.jurnal_id = j.id and t.dimension_id = p_dimension))
   group by a.kode, a.nama, a.golongan
$$;

create or replace function public.budget_report(p_dari date, p_sampai date, p_dimension uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); v_baris jsonb;
begin
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  if p_dimension is not null and not exists (select 1 from public.dimension where id = p_dimension and perusahaan_id = v_pid) then
    raise exception 'Cabang atau proyek tidak ditemukan' using errcode = 'P0002';
  end if;
  with ang as (
    select a.kode, a.nama, a.golongan, sum(g.nominal)::bigint as anggaran
      from public.budget g join public.akun a on a.id = g.akun_id
     where g.perusahaan_id = v_pid and g.bulan between date_trunc('month', p_dari)::date and p_sampai and g.nominal > 0
     group by a.kode, a.nama, a.golongan
  ), rea as (select * from app.gerak_lr(v_pid, p_dari, p_sampai, p_dimension)),
  gab as (
    select coalesce(ang.kode, rea.kode) as kode, coalesce(ang.nama, rea.nama) as nama, coalesce(ang.golongan, rea.golongan) as golongan,
           coalesce(ang.anggaran, 0) as anggaran, coalesce(rea.nilai, 0) as realisasi
      from ang full join rea on rea.kode = ang.kode
  )
  select jsonb_build_object(
    'baris', coalesce(jsonb_agg(jsonb_build_object('kode', kode, 'nama', nama, 'golongan', golongan, 'anggaran', anggaran, 'realisasi', realisasi,
              'selisih', realisasi - anggaran, 'persen', case when anggaran > 0 then round(realisasi * 100.0 / anggaran) end) order by kode)
              filter (where anggaran <> 0 or realisasi <> 0), '[]'),
    'pendapatan', jsonb_build_object('anggaran', coalesce(sum(anggaran) filter (where golongan = 'pendapatan'), 0), 'realisasi', coalesce(sum(realisasi) filter (where golongan = 'pendapatan'), 0)),
    'beban', jsonb_build_object('anggaran', coalesce(sum(anggaran) filter (where golongan = 'beban'), 0), 'realisasi', coalesce(sum(realisasi) filter (where golongan = 'beban'), 0)),
    'laba', jsonb_build_object('anggaran', coalesce(sum(anggaran) filter (where golongan = 'pendapatan'), 0) - coalesce(sum(anggaran) filter (where golongan = 'beban'), 0),
                               'realisasi', coalesce(sum(realisasi) filter (where golongan = 'pendapatan'), 0) - coalesce(sum(realisasi) filter (where golongan = 'beban'), 0)))
    into v_baris from gab;
  return v_baris || jsonb_build_object('dari', p_dari, 'sampai', p_sampai, 'dimensi', p_dimension);
end $$;

-- Laba rugi per cabang atau proyek, ditambah baris "tanpa tag".
create or replace function public.dimension_report(p_jenis text, p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); v jsonb;
begin
  if p_jenis not in ('cabang', 'proyek') then raise exception 'Jenis dimensi: cabang atau proyek' using errcode = '22023'; end if;
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  with g as (
    select t.dimension_id,
           sum(case when a.golongan = 'pendapatan' then b.kredit - b.debit else 0 end)::bigint as pendapatan,
           sum(case when a.golongan = 'beban' then b.debit - b.kredit else 0 end)::bigint as beban
      from public.jurnal_baris b
      join public.jurnal j on j.id = b.jurnal_id and j.perusahaan_id = v_pid
      join public.akun a on a.id = b.akun_id and a.golongan in ('pendapatan', 'beban')
      left join public.journal_tag t on t.jurnal_id = j.id and t.jenis = p_jenis
     where b.perusahaan_id = v_pid and j.tanggal between p_dari and p_sampai and j.sumber <> 'tutup_buku'
     group by t.dimension_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('dimensi', d.id, 'nama', coalesce(d.nama, null), 'pendapatan', coalesce(g.pendapatan, 0),
           'beban', coalesce(g.beban, 0), 'laba', coalesce(g.pendapatan, 0) - coalesce(g.beban, 0)) order by d.nama nulls last), '[]')
    into v
    from g full join (select id, nama from public.dimension where perusahaan_id = v_pid and jenis = p_jenis and aktif) d on d.id = g.dimension_id
   where d.id is not null or g.dimension_id is null;
  return jsonb_build_object('jenis', p_jenis, 'dari', p_dari, 'sampai', p_sampai, 'baris', v);
end $$;

-- ---------- 3. Jurnal berulang ----------
create table public.recurring_journal (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 3 and 80),
  tiap text not null check (tiap in ('bulan', 'minggu')),
  mulai date not null,
  sampai date check (sampai is null or sampai >= mulai),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 2 and 20),
  dimension_id uuid,
  aktif boolean not null default true,
  kali int not null default 0 check (kali >= 0),
  berikutnya date not null,
  galat text check (galat is null or length(galat) <= 300),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  foreign key (perusahaan_id, dimension_id) references public.dimension (perusahaan_id, id)
);
create index on public.recurring_journal (berikutnya) where aktif;
alter table public.recurring_journal enable row level security;
create policy recurring_journal_baca on public.recurring_journal for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.recurring_journal to authenticated;
create trigger audit_recurring_journal after insert or update or delete on public.recurring_journal for each row execute function app.catat_audit();

create or replace function public.save_recurring_journal(p_nama text, p_tiap text, p_mulai date, p_sampai date, p_baris jsonb, p_dimension uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); e jsonb; d numeric := 0; k numeric := 0; v_id uuid;
begin
  if length(btrim(coalesce(p_nama, ''))) not between 3 and 80 then raise exception 'Nama jurnal berulang 3 sampai 80 huruf' using errcode = '22023'; end if;
  if p_tiap not in ('bulan', 'minggu') then raise exception 'Ulangi tiap bulan atau tiap minggu' using errcode = '22023'; end if;
  if p_mulai is null or p_mulai < app.hari_ini(v_pid) - 366 then raise exception 'Tanggal mulai paling lama setahun lalu' using errcode = '22023'; end if;
  if p_sampai is not null and p_sampai < p_mulai then raise exception 'Tanggal selesai sebelum tanggal mulai' using errcode = '22023'; end if;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 2 and 20 then
    raise exception 'Jurnal berulang butuh 2 sampai 20 baris' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    if not exists (select 1 from public.akun a where a.perusahaan_id = v_pid and a.kode = e ->> 'akun' and a.aktif) then
      raise exception 'Akun % tidak ada di bagan akun usaha ini', coalesce(e ->> 'akun', '(kosong)') using errcode = 'P0002';
    end if;
    d := d + coalesce((e ->> 'debit')::numeric, 0);
    k := k + coalesce((e ->> 'kredit')::numeric, 0);
  end loop;
  if d <> k or d <= 0 or d <> trunc(d) then raise exception 'Jurnal tidak seimbang: debit % dan kredit %', d, k using errcode = '23514'; end if;
  if p_dimension is not null and not exists (select 1 from public.dimension where id = p_dimension and perusahaan_id = v_pid and aktif) then
    raise exception 'Cabang atau proyek tidak ditemukan' using errcode = 'P0002';
  end if;
  insert into public.recurring_journal (perusahaan_id, nama, tiap, mulai, sampai, baris, dimension_id, berikutnya, dibuat_oleh)
  values (v_pid, btrim(p_nama), p_tiap, p_mulai, p_sampai, p_baris, p_dimension, p_mulai, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_recurring_active(p_id uuid, p_aktif boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true);
begin
  update public.recurring_journal set aktif = coalesce(p_aktif, false), galat = null where id = p_id and perusahaan_id = v_pid;
  if not found then raise exception 'Jurnal berulang tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

-- Bukukan semua jadwal yang jatuh tempo sampai p_sampai (paling banyak 60 per jadwal per panggilan). Kunci idempoten per tanggal,
-- jadi dijalankan dua kali (cron dan tombol) tidak membuat jurnal ganda. Tanggal dihitung dari mulai + n kali, tanpa geser hari.
-- Bila bulan terkunci atau akun dinonaktifkan, galat dicatat di jadwal dan jadwal lain tetap jalan.
create or replace function app.run_recurring(p_pid uuid, p_sampai date) returns int
language plpgsql security definer set search_path = '' as $$
declare r public.recurring_journal; n int := 0; i int; v_tgl date; x jsonb;
begin
  for r in select * from public.recurring_journal where perusahaan_id = p_pid and aktif and berikutnya <= p_sampai
            and (sampai is null or berikutnya <= sampai) for update skip locked loop
    i := 0;
    v_tgl := r.berikutnya;
    begin
      while v_tgl <= p_sampai and (r.sampai is null or v_tgl <= r.sampai) and i < 60 loop
        x := app.posting_jurnal(p_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', r.nama, 'sumber', 'berulang', 'sumber_id', r.id::text,
               'kunci_idempoten', 'berulang:' || r.id || ':' || v_tgl), r.baris, r.dibuat_oleh);
        if r.dimension_id is not null then
          insert into public.journal_tag (perusahaan_id, jurnal_id, jenis, dimension_id, sumber)
          select p_pid, (x ->> 'id')::uuid, d.jenis, d.id, 'berulang' from public.dimension d where d.id = r.dimension_id
          on conflict (jurnal_id, jenis) do nothing;
        end if;
        if (x ->> 'baru')::boolean then n := n + 1; end if;
        i := i + 1;
        v_tgl := case when r.tiap = 'bulan' then (r.mulai + make_interval(months => r.kali + i))::date else r.mulai + 7 * (r.kali + i) end;
      end loop;
      update public.recurring_journal set kali = kali + i, berikutnya = v_tgl, galat = null,
             aktif = case when sampai is not null and v_tgl > sampai then false else aktif end
       where id = r.id;
    exception when others then
      update public.recurring_journal set galat = left(sqlerrm, 300) where id = r.id;
    end;
  end loop;
  return n;
end $$;

create or replace function public.run_recurring_journals() returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true);
begin
  return app.run_recurring(v_pid, app.hari_ini(v_pid));
end $$;

create or replace function app.run_recurring_all() returns int
language plpgsql security definer set search_path = '' as $$
declare p uuid; n int := 0;
begin
  for p in select distinct perusahaan_id from public.recurring_journal where aktif and berikutnya <= current_date + 1 loop
    n := n + app.run_recurring(p, app.hari_ini(p));
  end loop;
  return n;
end $$;
select cron.schedule('nadi-jurnal-berulang', '15 17 * * *', 'select app.run_recurring_all()');

-- ---------- 4. Kurs ----------
-- perusahaan_id null = kurs pajak resmi (KMK Menteri Keuangan, berlaku Rabu sampai Selasa), dipakai bersama. Kurs per 1 unit,
-- kecuali `per` (JPY ditetapkan per 100 yen).
create table public.fx_rate (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid references public.perusahaan(id) on delete cascade,
  valuta text not null check (valuta ~ '^[A-Z]{3}$' and valuta <> 'IDR'),
  berlaku_dari date not null,
  berlaku_sampai date check (berlaku_sampai is null or berlaku_sampai >= berlaku_dari),
  kurs numeric(14, 4) not null check (kurs > 0 and kurs < 10000000),
  per int not null default 1 check (per in (1, 100)),
  sumber text not null check (length(btrim(sumber)) between 3 and 160),
  dibuat_at timestamptz not null default now(),
  unique nulls not distinct (perusahaan_id, valuta, berlaku_dari)
);
alter table public.fx_rate enable row level security;
create policy fx_rate_baca on public.fx_rate for select to authenticated
  using (perusahaan_id is null or perusahaan_id = (select app.pid()));
grant select on public.fx_rate to authenticated;
insert into public.fx_rate (perusahaan_id, valuta, berlaku_dari, berlaku_sampai, kurs, per, sumber) values
  (null, 'USD', '2026-11-04', '2026-11-10', 18141.00, 1, 'KMK Nomor 53/MK/EF.2/2026 (kurs pajak), fiskal.kemenkeu.go.id'),
  (null, 'SGD', '2026-11-04', '2026-11-10', 14169.62, 1, 'KMK Nomor 53/MK/EF.2/2026 (kurs pajak), fiskal.kemenkeu.go.id'),
  (null, 'EUR', '2026-11-04', '2026-11-10', 20242.59, 1, 'KMK Nomor 53/MK/EF.2/2026 (kurs pajak), fiskal.kemenkeu.go.id'),
  (null, 'JPY', '2026-11-04', '2026-11-10', 11502.49, 100, 'KMK Nomor 53/MK/EF.2/2026 (kurs pajak), fiskal.kemenkeu.go.id'),
  (null, 'CNY', '2026-11-04', '2026-11-10', 2723.57, 1, 'KMK Nomor 53/MK/EF.2/2026 (kurs pajak), fiskal.kemenkeu.go.id');

create or replace function public.save_fx_rate(p_valuta text, p_tanggal date, p_kurs numeric, p_sumber text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); v_id uuid;
begin
  if p_valuta is null or upper(btrim(p_valuta)) !~ '^[A-Z]{3}$' or upper(btrim(p_valuta)) = 'IDR' then
    raise exception 'Kode valuta 3 huruf, mis. USD' using errcode = '22023';
  end if;
  if p_kurs is null or p_kurs <= 0 or p_kurs >= 10000000 or p_kurs <> round(p_kurs, 4) then
    raise exception 'Kurs rupiah per 1 unit valuta, paling banyak 4 angka desimal' using errcode = '22023';
  end if;
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) then raise exception 'Tanggal kurs tidak boleh di masa depan' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_sumber, ''))) not between 3 and 160 then raise exception 'Tulis sumber kurs, mis. kurs tengah BI' using errcode = '22023'; end if;
  insert into public.fx_rate (perusahaan_id, valuta, berlaku_dari, kurs, sumber) values (v_pid, upper(btrim(p_valuta)), p_tanggal, p_kurs, btrim(p_sumber))
  on conflict (perusahaan_id, valuta, berlaku_dari) do update set kurs = excluded.kurs, sumber = excluded.sumber
  returning id into v_id;
  return v_id;
end $$;

-- Kurs yang berlaku pada tanggal: yang paling baru berlaku_dari <= tanggal (dan belum lewat berlaku_sampai); seri: kurs usaha menang.
create or replace function public.fx_rate_on(p_valuta text, p_tanggal date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('valuta', f.valuta, 'kurs', f.kurs, 'per', f.per, 'sumber', f.sumber, 'berlaku_dari', f.berlaku_dari,
           'resmi', f.perusahaan_id is null)
    from public.fx_rate f
   where f.valuta = upper(btrim(p_valuta)) and f.berlaku_dari <= p_tanggal and (f.berlaku_sampai is null or f.berlaku_sampai >= p_tanggal)
     and (f.perusahaan_id is null or f.perusahaan_id = app.pid())
   order by f.berlaku_dari desc, (f.perusahaan_id is null)
   limit 1
$$;

-- ---------- 5. Revaluasi dan pelunasan invoice ekspor ----------
alter table public.invoice_ekspor add column nilai_buku bigint, add column kurs_buku numeric(12, 4),
  add column lunas_tanggal date, add column kurs_lunas numeric(12, 4), add column jurnal_lunas uuid;
update public.invoice_ekspor set nilai_buku = total_rupiah, kurs_buku = kurs where nilai_buku is null;
alter table public.invoice_ekspor alter column nilai_buku set not null, alter column kurs_buku set not null;
alter table public.invoice_ekspor drop constraint invoice_ekspor_status_check;
alter table public.invoice_ekspor add constraint invoice_ekspor_status_check check (status in ('terbit', 'lunas', 'batal'));

create or replace function app.invoice_ekspor_nilai_buku() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nilai_buku := coalesce(new.nilai_buku, new.total_rupiah);
  new.kurs_buku := coalesce(new.kurs_buku, new.kurs);
  return new;
end $$;
create trigger invoice_ekspor_nilai_buku before insert on public.invoice_ekspor for each row execute function app.invoice_ekspor_nilai_buku();

-- Revaluasi piutang valas yang belum dibayar per tanggal (biasanya akhir bulan) ke kurs baru. Selisih ke laba/rugi selisih kurs
-- (belum terealisasi). Idempoten per invoice per tanggal.
create or replace function public.revalue_fx(p_tanggal date, p_kurs numeric, p_sumber text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(true); inv public.invoice_ekspor; v_baru bigint; v_d bigint; x jsonb; n int := 0; total bigint := 0;
begin
  if p_tanggal is null or p_tanggal > app.hari_ini(v_pid) then raise exception 'Tanggal revaluasi tidak boleh di masa depan' using errcode = '22023'; end if;
  if p_kurs is null or p_kurs < 1000 or p_kurs > 100000 or p_kurs <> round(p_kurs, 4) then
    raise exception 'Kurs USD antara Rp1.000 dan Rp100.000' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_sumber, ''))) not between 3 and 160 then raise exception 'Tulis sumber kurs revaluasi' using errcode = '22023'; end if;
  perform app.ensure_account(v_pid, '4-920', 'Laba selisih kurs', 'pendapatan', 'kredit');
  perform app.ensure_account(v_pid, '6-920', 'Rugi selisih kurs', 'beban', 'debit');
  for inv in select * from public.invoice_ekspor where perusahaan_id = v_pid and status = 'terbit' and tanggal <= p_tanggal order by tanggal for update loop
    v_baru := round(inv.total_usd * p_kurs)::bigint;
    v_d := v_baru - inv.nilai_buku;
    continue when v_d = 0;
    x := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal,
           'keterangan', left('Revaluasi ' || inv.nomor || ': USD ' || to_char(inv.total_usd, 'FM999999999990.00') || ' x Rp' || trim_scale(p_kurs)::text || ' (' || btrim(p_sumber) || ')', 200),
           'sumber', 'revaluasi', 'sumber_id', inv.id::text, 'kunci_idempoten', 'revaluasi:' || inv.id || ':' || p_tanggal),
         case when v_d > 0 then jsonb_build_array(jsonb_build_object('akun', '1-210', 'debit', v_d), jsonb_build_object('akun', '4-920', 'kredit', v_d))
              else jsonb_build_array(jsonb_build_object('akun', '6-920', 'debit', -v_d), jsonb_build_object('akun', '1-210', 'kredit', -v_d)) end,
         auth.uid());
    if (x ->> 'baru')::boolean then
      update public.invoice_ekspor set nilai_buku = v_baru, kurs_buku = p_kurs where id = inv.id;
      n := n + 1;
      total := total + v_d;
    end if;
  end loop;
  return jsonb_build_object('invoice', n, 'selisih', total);
end $$;

-- Pelunasan invoice ekspor pada kurs hari bayar: kas/bank diterima rupiah sebenarnya, piutang ditutup sebesar nilai buku,
-- selisihnya laba atau rugi selisih kurs yang terealisasi.
create or replace function public.settle_export_invoice(p_id uuid, p_tanggal date, p_kurs numeric, p_kurs_sumber text, p_akun text default '1-110') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice_ekspor; v_terima bigint; v_d bigint; v_baris jsonb; x jsonb; v_ket text;
begin
  select * into inv from public.invoice_ekspor where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice ekspor tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'lunas' then return jsonb_build_object('id', inv.id, 'sudah', true); end if;
  if inv.status <> 'terbit' then raise exception 'Invoice ekspor ini sudah dibatalkan' using errcode = '22023'; end if;
  if p_akun not in ('1-100', '1-110') then raise exception 'Uang diterima di kas (1-100) atau bank (1-110)' using errcode = '22023'; end if;
  if p_tanggal is null or p_tanggal < inv.tanggal or p_tanggal > app.hari_ini(v_pid) then
    raise exception 'Tanggal bayar antara tanggal invoice dan hari ini' using errcode = '22023';
  end if;
  if p_kurs is null or p_kurs < 1000 or p_kurs > 100000 or p_kurs <> round(p_kurs, 4) then
    raise exception 'Kurs USD antara Rp1.000 dan Rp100.000' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_kurs_sumber, ''))) not between 3 and 160 then raise exception 'Tulis sumber kurs hari bayar, mis. kurs bank' using errcode = '22023'; end if;
  perform app.ensure_account(v_pid, '4-920', 'Laba selisih kurs', 'pendapatan', 'kredit');
  perform app.ensure_account(v_pid, '6-920', 'Rugi selisih kurs', 'beban', 'debit');
  v_terima := round(inv.total_usd * p_kurs)::bigint;
  v_d := v_terima - inv.nilai_buku;
  v_ket := left('Pelunasan ' || inv.nomor || ': USD ' || to_char(inv.total_usd, 'FM999999999990.00') || ' x Rp' || trim_scale(p_kurs)::text || ' (' || btrim(p_kurs_sumber) || ')', 200);
  v_baris := jsonb_build_array(jsonb_build_object('akun', p_akun, 'debit', v_terima), jsonb_build_object('akun', '1-210', 'kredit', inv.nilai_buku));
  if v_d > 0 then v_baris := v_baris || jsonb_build_object('akun', '4-920', 'kredit', v_d);
  elsif v_d < 0 then v_baris := v_baris || jsonb_build_object('akun', '6-920', 'debit', -v_d); end if;
  x := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal, 'keterangan', v_ket, 'sumber', 'invoice_ekspor.lunas', 'sumber_id', inv.id::text,
         'kunci_idempoten', 'lunas_ekspor:' || inv.id), v_baris, auth.uid());
  update public.invoice_ekspor set status = 'lunas', lunas_tanggal = p_tanggal, kurs_lunas = p_kurs, jurnal_lunas = (x ->> 'id')::uuid where id = inv.id;
  return jsonb_build_object('id', inv.id, 'sudah', false, 'diterima', v_terima, 'selisih_kurs', v_d);
end $$;

-- Batal hanya untuk invoice yang belum dibayar dan belum direvaluasi (jurnal balik terbit tidak menutup selisih revaluasi).
create or replace function public.batal_invoice_ekspor(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice_ekspor;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan invoice dibatalkan.' using errcode = '22023';
  end if;
  select * into inv from public.invoice_ekspor where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice ekspor tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'batal' then return jsonb_build_object('id', inv.id, 'sudah', true); end if;
  if inv.status = 'lunas' then raise exception 'Invoice ekspor ini sudah lunas dan tidak bisa dibatalkan.' using errcode = '22023'; end if;
  if inv.nilai_buku <> inv.total_rupiah then
    raise exception 'Invoice ekspor ini sudah direvaluasi. Balik jurnal revaluasinya dulu di Buku, lalu batalkan.' using errcode = '22023';
  end if;
  perform public.balik_jurnal(inv.jurnal_terbit, 'Invoice ekspor ' || inv.nomor || ' dibatalkan: ' || btrim(p_alasan));
  update public.nomor_terbit set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), dibatalkan_oleh = auth.uid(), dibatalkan_at = now()
   where id = inv.nomor_terbit_id and status = 'terbit';
  update public.invoice_ekspor set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), batal_at = now() where id = inv.id;
  return jsonb_build_object('id', inv.id, 'sudah', false);
end $$;

-- ---------- 6. Konsolidasi ----------
-- Satu transaksi antarusaha dicatat sebagai sepasang jurnal (satu di tiap usaha) yang saling meniadakan di tingkat grup.
create table public.intercompany_journal (
  perusahaan_id uuid not null,
  jurnal_id uuid not null,
  mitra_id uuid not null references public.perusahaan(id) on delete cascade,
  pasangan uuid not null,
  dibuat_at timestamptz not null default now(),
  primary key (jurnal_id),
  foreign key (perusahaan_id, jurnal_id) references public.jurnal (perusahaan_id, id)
);
create index on public.intercompany_journal (perusahaan_id, mitra_id);
alter table public.intercompany_journal enable row level security;
create policy intercompany_journal_baca on public.intercompany_journal for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.intercompany_journal to authenticated;

create or replace function app.pemilik_dari(p_perusahaan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.anggota a where a.perusahaan_id = p_perusahaan and a.user_id = auth.uid() and a.aktif and a.peran = 'pemilik')
$$;

-- jenis: jual (usaha aktif menjual ke mitra), pinjam (usaha aktif meminjamkan uang ke mitra), bayar (mitra membayar utangnya ke usaha aktif).
create or replace function public.post_intercompany(p_mitra uuid, p_tanggal date, p_jenis text, p_nominal bigint, p_keterangan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_pasang uuid; a jsonb; b jsonb; ka text; kb text; v_ket text; na text; nb text;
begin
  if v_pid is null or not app.pemilik_dari(v_pid) or p_mitra is null or not app.pemilik_dari(p_mitra) then
    raise exception 'Transaksi antarusaha hanya untuk pemilik kedua usaha' using errcode = '42501';
  end if;
  if p_mitra = v_pid then raise exception 'Pilih usaha lain milikmu' using errcode = '22023'; end if;
  if p_jenis not in ('jual', 'pinjam', 'bayar') then raise exception 'Jenis: jual, pinjam, atau bayar' using errcode = '22023'; end if;
  if p_nominal is null or p_nominal <= 0 or p_nominal > 100000000000 then raise exception 'Isi nominal dalam rupiah' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_keterangan, ''))) not between 3 and 150 then raise exception 'Tulis keterangan transaksi 3 sampai 150 huruf' using errcode = '22023'; end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select pasangan into v_pasang from public.intercompany_journal i join public.jurnal j on j.id = i.jurnal_id
   where i.perusahaan_id = v_pid and j.kunci_idempoten = 'antarusaha:' || p_kunci || ':a';
  if found then return jsonb_build_object('pasangan', v_pasang, 'baru', false); end if;
  select nama into na from public.perusahaan where id = v_pid;
  select nama into nb from public.perusahaan where id = p_mitra;
  for v_ket in select unnest(array[v_pid::text, p_mitra::text]) loop
    perform app.ensure_account(v_ket::uuid, '1-250', 'Piutang antarusaha', 'aset', 'debit');
    perform app.ensure_account(v_ket::uuid, '2-250', 'Utang antarusaha', 'kewajiban', 'kredit');
    if not exists (select 1 from public.akun where perusahaan_id = v_ket::uuid and kode = '4-100') then perform app.pasang_bagan_bawaan(v_ket::uuid); end if;
  end loop;
  v_ket := btrim(p_keterangan);
  -- a = jurnal usaha aktif, b = jurnal mitra.
  case p_jenis
    when 'jual' then
      a := jsonb_build_array(jsonb_build_object('akun', '1-250', 'debit', p_nominal), jsonb_build_object('akun', '4-100', 'kredit', p_nominal));
      b := jsonb_build_array(jsonb_build_object('akun', '6-900', 'debit', p_nominal), jsonb_build_object('akun', '2-250', 'kredit', p_nominal));
    when 'pinjam' then
      a := jsonb_build_array(jsonb_build_object('akun', '1-250', 'debit', p_nominal), jsonb_build_object('akun', '1-110', 'kredit', p_nominal));
      b := jsonb_build_array(jsonb_build_object('akun', '1-110', 'debit', p_nominal), jsonb_build_object('akun', '2-250', 'kredit', p_nominal));
    else
      a := jsonb_build_array(jsonb_build_object('akun', '1-110', 'debit', p_nominal), jsonb_build_object('akun', '1-250', 'kredit', p_nominal));
      b := jsonb_build_array(jsonb_build_object('akun', '2-250', 'debit', p_nominal), jsonb_build_object('akun', '1-110', 'kredit', p_nominal));
  end case;
  ka := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', p_tanggal, 'keterangan', left(v_ket || ' (antarusaha ' || nb || ')', 200), 'sumber', 'antarusaha',
          'kunci_idempoten', 'antarusaha:' || p_kunci || ':a'), a, auth.uid()) ->> 'id';
  kb := app.posting_jurnal(p_mitra, jsonb_build_object('tanggal', p_tanggal, 'keterangan', left(v_ket || ' (antarusaha ' || na || ')', 200), 'sumber', 'antarusaha',
          'kunci_idempoten', 'antarusaha:' || p_kunci || ':b'), b, auth.uid()) ->> 'id';
  v_pasang := app.uuid7();
  insert into public.intercompany_journal (perusahaan_id, jurnal_id, mitra_id, pasangan) values
    (v_pid, ka::uuid, p_mitra, v_pasang), (p_mitra, kb::uuid, v_pid, v_pasang);
  return jsonb_build_object('pasangan', v_pasang, 'baru', true, 'jurnal', ka, 'jurnal_mitra', kb);
end $$;

-- Laporan konsolidasi: jumlah per kode akun dari 2 sampai 10 usaha milik pemanggil, tanpa jurnal antarusaha yang mitranya
-- ikut dalam grup (eliminasi). Neraca per p_sampai, laba rugi dalam rentang tanpa jurnal tutup buku.
create or replace function public.consolidated_report(p_perusahaan uuid[], p_dari date, p_sampai date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_grup uuid[]; v_usaha jsonb; v_nr jsonb; v_lr jsonb; aset bigint; kew bigint; modal bigint; laba_tutup bigint; pend bigint; beban bigint;
  v_elim_n int; v_elim bigint;
begin
  select array_agg(distinct x) into v_grup from unnest(p_perusahaan) x;
  if v_grup is null or cardinality(v_grup) not between 2 and 10 then raise exception 'Pilih 2 sampai 10 usaha' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_grup) g where not app.pemilik_dari(g)) then
    raise exception 'Konsolidasi hanya untuk usaha yang kamu miliki' using errcode = '42501';
  end if;
  if p_dari is null or p_sampai is null or p_dari > p_sampai or p_sampai - p_dari > 3700 then
    raise exception 'Rentang tanggal tidak sah' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('id', id, 'nama', nama) order by nama) into v_usaha from public.perusahaan where id = any(v_grup);
  select count(*), coalesce(sum(b.debit), 0) into v_elim_n, v_elim
    from public.intercompany_journal i join public.jurnal j on j.id = i.jurnal_id join public.jurnal_baris b on b.jurnal_id = j.id
   where i.perusahaan_id = any(v_grup) and i.mitra_id = any(v_grup) and j.tanggal <= p_sampai;
  with baris as (
    select a.kode, a.golongan, j.tanggal, j.sumber, b.debit, b.kredit
      from public.jurnal_baris b
      join public.jurnal j on j.id = b.jurnal_id and j.perusahaan_id = b.perusahaan_id
      join public.akun a on a.id = b.akun_id
     where b.perusahaan_id = any(v_grup) and j.tanggal <= p_sampai
       and not exists (select 1 from public.intercompany_journal i where i.jurnal_id = j.id and i.mitra_id = any(v_grup))
  ), nama as (select distinct on (kode) kode, nama from public.akun where perusahaan_id = any(v_grup) order by kode, bawaan desc, nama),
  s as (
    select kode, golongan,
           (case when golongan in ('aset', 'beban') then 1 else -1 end * sum(debit - kredit))::bigint as akhir,
           (case when golongan in ('aset', 'beban') then 1 else -1 end * coalesce(sum(debit - kredit) filter (where tanggal >= p_dari and sumber <> 'tutup_buku'), 0))::bigint as gerak
      from baris group by kode, golongan
  )
  select coalesce(sum(akhir) filter (where golongan = 'aset'), 0), coalesce(sum(akhir) filter (where golongan = 'kewajiban'), 0),
         coalesce(sum(akhir) filter (where golongan = 'modal'), 0),
         coalesce(sum(akhir) filter (where golongan = 'pendapatan'), 0) - coalesce(sum(akhir) filter (where golongan = 'beban'), 0),
         coalesce(sum(gerak) filter (where golongan = 'pendapatan'), 0), coalesce(sum(gerak) filter (where golongan = 'beban'), 0),
         jsonb_agg(jsonb_build_object('kode', s.kode, 'nama', n.nama, 'golongan', golongan, 'saldo', akhir) order by s.kode) filter (where golongan in ('aset', 'kewajiban', 'modal') and akhir <> 0),
         jsonb_agg(jsonb_build_object('kode', s.kode, 'nama', n.nama, 'golongan', golongan, 'nilai', gerak) order by s.kode) filter (where golongan in ('pendapatan', 'beban') and gerak <> 0)
    into aset, kew, modal, laba_tutup, pend, beban, v_nr, v_lr
    from s join nama n on n.kode = s.kode;
  return jsonb_build_object('usaha', v_usaha, 'dari', p_dari, 'sampai', p_sampai,
    'neraca', jsonb_build_object('baris', coalesce(v_nr, '[]'), 'aset', aset, 'kewajiban', kew, 'modal', modal, 'laba_belum_ditutup', laba_tutup,
      'seimbang', aset = kew + modal + laba_tutup),
    'laba_rugi', jsonb_build_object('baris', coalesce(v_lr, '[]'), 'pendapatan', pend, 'beban', beban, 'laba', pend - beban),
    'eliminasi', jsonb_build_object('jurnal', coalesce(v_elim_n, 0), 'nilai', coalesce(v_elim, 0)));
end $$;

-- Daftar usaha yang dimiliki pemanggil (pilihan konsolidasi dan mitra antarusaha).
create or replace function public.owned_companies() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nama', p.nama) order by p.nama), '[]')
    from public.perusahaan p join public.anggota a on a.perusahaan_id = p.id
   where a.user_id = auth.uid() and a.aktif and a.peran = 'pemilik'
$$;

revoke all on function app.ensure_account(uuid, text, text, text, text), app.apply_tag_rules_to(uuid, uuid, text), app.tag_jurnal_baru(),
  app.gerak_lr(uuid, date, date, uuid), app.run_recurring(uuid, date), app.run_recurring_all(), app.invoice_ekspor_nilai_buku(),
  app.pemilik_dari(uuid) from public, anon, authenticated;
revoke all on function public.set_budget(text, date, bigint, date), public.save_dimension(text, text, boolean), public.tag_journal(uuid, uuid),
  public.save_tag_rule(uuid, text, boolean), public.apply_tag_rules(date, date), public.budget_report(date, date, uuid),
  public.dimension_report(text, date, date), public.save_recurring_journal(text, text, date, date, jsonb, uuid),
  public.set_recurring_active(uuid, boolean), public.run_recurring_journals(), public.save_fx_rate(text, date, numeric, text),
  public.fx_rate_on(text, date), public.revalue_fx(date, numeric, text), public.settle_export_invoice(uuid, date, numeric, text, text),
  public.post_intercompany(uuid, date, text, bigint, text, uuid), public.consolidated_report(uuid[], date, date), public.owned_companies() from public, anon;
grant execute on function public.set_budget(text, date, bigint, date), public.save_dimension(text, text, boolean), public.tag_journal(uuid, uuid),
  public.save_tag_rule(uuid, text, boolean), public.apply_tag_rules(date, date), public.budget_report(date, date, uuid),
  public.dimension_report(text, date, date), public.save_recurring_journal(text, text, date, date, jsonb, uuid),
  public.set_recurring_active(uuid, boolean), public.run_recurring_journals(), public.save_fx_rate(text, date, numeric, text),
  public.fx_rate_on(text, date), public.revalue_fx(date, numeric, text), public.settle_export_invoice(uuid, date, numeric, text, text),
  public.post_intercompany(uuid, date, text, bigint, text, uuid), public.consolidated_report(uuid[], date, date), public.owned_companies() to authenticated;
