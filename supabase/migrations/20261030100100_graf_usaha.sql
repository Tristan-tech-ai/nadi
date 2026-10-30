-- Graf Usaha: 8 primitif (orang, topi, kerja, tempat, aset, uang*, dokumen*, kejadian).
-- (*) uang (ledger) dan dokumen bernomor menyusul di migrasi fase F4.
-- Aturan skala:
--  * kejadian dan audit_log dipartisi per bulan (pg_partman), indeks BRIN untuk waktu.
--  * bidang fleksibel di kolom jsonb `data` dengan batas ukuran; bidang yang sering difilter dipromosikan jadi kolom.
--  * data sensitif (NIK, rekening, gaji) dipisah ke tabel sendiri dengan kebijakan khusus pengelola.

-- ===== Orang =====
create table public.orang (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(nama) between 1 and 160),
  jenis text[] not null default '{karyawan}',   -- karyawan, kandidat, magang, pelanggan, pemasok, mitra, akuntan
  status text not null default 'aktif',          -- aktif, nonaktif, keluar, kandidat_*, ...
  telepon text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 32768),
  ringkasan text,                                -- paket konteks untuk AI, diperbarui bertahap
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create index on public.orang (perusahaan_id, status);
create index on public.orang using gin (jenis);
create index on public.orang using gin (nama extensions.gin_trgm_ops);
create unique index on public.orang (perusahaan_id, user_id) where user_id is not null;
create trigger orang_diubah before update on public.orang for each row execute function app.set_diubah();

alter table public.anggota add constraint anggota_orang_fk foreign key (orang_id) references public.orang(id) on delete set null;
create index on public.anggota (orang_id);

create table public.orang_rahasia (
  orang_id uuid primary key references public.orang(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nik_hash text,               -- sha256(nik + garam perusahaan): untuk deteksi duplikat tanpa menyimpan NIK polos
  nik_akhir text,              -- 4 digit terakhir untuk tampilan
  rekening_hash text,
  rekening_akhir text,
  gaji jsonb not null default '{}'::jsonb,
  diubah_at timestamptz not null default now()
);
create index on public.orang_rahasia (perusahaan_id, nik_hash);
create index on public.orang_rahasia (perusahaan_id, rekening_hash);
create trigger orang_rahasia_diubah before update on public.orang_rahasia for each row execute function app.set_diubah();

-- ===== Topi (peran kerja) =====
create table public.topi (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null,
  nama text not null,
  deskripsi text,
  tanggung_jawab jsonb not null default '[]'::jsonb,  -- [{tugas, raci}]
  keahlian jsonb not null default '[]'::jsonb,        -- [{nama, level}]
  kpi jsonb not null default '[]'::jsonb,             -- [{kode, nama, rumus, arah}]
  komponen_gaji jsonb not null default '{}'::jsonb,
  asal_paket text,                                    -- paket industri asal (null = buatan sendiri)
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (perusahaan_id, kode)
);
create trigger topi_diubah before update on public.topi for each row execute function app.set_diubah();

create table public.pakai_topi (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  orang_id uuid not null references public.orang(id) on delete cascade,
  topi_id uuid not null references public.topi(id) on delete cascade,
  porsi numeric(5,2) not null default 100 check (porsi > 0 and porsi <= 100),
  mulai date not null default current_date,
  selesai date,
  check (selesai is null or selesai >= mulai)
);
create index on public.pakai_topi (perusahaan_id, orang_id);
create index on public.pakai_topi (topi_id);

-- ===== Tempat (hirarki dengan ltree: outlet.zona.meja) =====
create table public.tempat (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  induk_id uuid references public.tempat(id) on delete cascade,
  jalur extensions.ltree not null,
  nama text not null,
  jenis text not null default 'lokasi',   -- lokasi, zona, meja, rak, bay, ruang, gudang
  lat double precision,
  lng double precision,
  radius_m integer,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 16384),
  aktif boolean not null default true
);
create index on public.tempat (perusahaan_id, jenis);
create index on public.tempat using gist (jalur);
create index on public.tempat (induk_id);

-- ===== Aset =====
create table public.aset (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null,
  jenis text not null default 'alat',     -- alat, kendaraan, akun_sistem, kunci, perangkat
  pemegang_id uuid references public.orang(id) on delete set null,
  tempat_id uuid references public.tempat(id) on delete set null,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 16384),
  aktif boolean not null default true
);
create index on public.aset (perusahaan_id, pemegang_id);
create index on public.aset (tempat_id);
create index on public.aset (pemegang_id);

-- ===== Kerja =====
create table public.kerja (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(judul) between 1 and 300),
  jenis text not null default 'tugas',
  topi_id uuid references public.topi(id) on delete set null,     -- topi yang seharusnya mengerjakan
  pelaksana_id uuid references public.orang(id) on delete set null,
  pemberi_id uuid references public.orang(id) on delete set null,
  tempat_id uuid references public.tempat(id) on delete set null,
  status text not null default 'baru',      -- baru, jalan, tunggu, selesai, batal
  poin_beban numeric(6,2),
  tenggat timestamptz,
  mulai_at timestamptz,
  selesai_at timestamptz,
  lintas_topi boolean not null default false,  -- dihitung trigger: pelaksana tidak memakai topi_id saat itu
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 32768),
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create index on public.kerja (perusahaan_id, status, tenggat);
create index on public.kerja (perusahaan_id, pelaksana_id, status);
create index on public.kerja (topi_id);
create index on public.kerja (pelaksana_id);
create index on public.kerja (pemberi_id);
create index on public.kerja (tempat_id);
create trigger kerja_diubah before update on public.kerja for each row execute function app.set_diubah();

create or replace function app.hitung_lintas_topi() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.lintas_topi := new.topi_id is not null and new.pelaksana_id is not null and not exists (
    select 1 from public.pakai_topi p
     where p.orang_id = new.pelaksana_id and p.topi_id = new.topi_id
       and p.mulai <= current_date and (p.selesai is null or p.selesai >= current_date));
  return new;
end $$;
create trigger kerja_lintas_topi before insert or update of topi_id, pelaksana_id on public.kerja
  for each row execute function app.hitung_lintas_topi();

-- ===== Kejadian (log semua yang terjadi; dipartisi per bulan) =====
create table public.kejadian (
  id uuid not null default app.uuid7(),
  perusahaan_id uuid not null,
  terjadi_at timestamptz not null default now(),
  jenis text not null,             -- absen.masuk, absen.pulang, meja.kosong, kerja.selesai, bayar.masuk, ...
  sumber text not null,            -- pwa, lempar, mata, pos, bank, mcp, sistem
  orang_id uuid,
  tempat_id uuid,
  kerja_id uuid,
  nilai numeric,                   -- angka utama kejadian (rupiah, menit, jumlah) untuk agregasi cepat
  keyakinan real check (keyakinan is null or keyakinan between 0 and 1),
  bukti text,                      -- jalur berkas bukti di Storage
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 8192),
  dicatat_at timestamptz not null default now(),
  primary key (id, terjadi_at)
) partition by range (terjadi_at);
create index on public.kejadian (perusahaan_id, jenis, terjadi_at desc);
create index on public.kejadian (perusahaan_id, orang_id, terjadi_at desc) where orang_id is not null;
create index on public.kejadian using brin (terjadi_at);

select partman.create_parent(
  p_parent_table := 'public.kejadian', p_control := 'terjadi_at', p_interval := '1 month', p_premake := 3);

-- ===== Berkas (kotak Lempar Saja) =====
create table public.berkas (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jalur text not null,              -- {perusahaan_id}/lempar/{id}.{ext} di bucket "berkas"
  nama_asli text,
  mime text,
  ukuran bigint,
  sha256 text,                      -- berkas sama tidak diproses dua kali
  sidik_tata_letak text,            -- sidik jari layout untuk ekstraktor terkompilasi
  jenis_terdeteksi text,            -- nota, invoice, slip_gaji, ktp, cv, surat, absen, excel_karyawan, ...
  status text not null default 'antre',  -- antre, proses, usulan, selesai, gagal
  hasil jsonb,
  galat text,
  token_ai integer not null default 0,
  diunggah_oleh uuid references auth.users(id) on delete set null,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create index on public.berkas (perusahaan_id, status, dibuat_at desc);
create unique index on public.berkas (perusahaan_id, sha256) where sha256 is not null;
create index on public.berkas (diunggah_oleh);
create trigger berkas_diubah before update on public.berkas for each row execute function app.set_diubah();

-- ===== Usulan (AI/aturan mengusulkan, manusia memutuskan) =====
create table public.usulan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  sumber text not null,               -- lempar, analis, aturan, mcp, mata
  aksi text not null,                 -- orang.buat, kerja.buat, izin.setujui, gaji.tahan, ...
  judul text not null,
  penjelasan text,
  payload jsonb not null,
  keyakinan real check (keyakinan is null or keyakinan between 0 and 1),
  dampak_rp numeric,
  tenggat timestamptz,
  berkas_id uuid references public.berkas(id) on delete set null,
  untuk_peran text[] not null default '{pemilik,admin}',
  status text not null default 'menunggu',   -- menunggu, diterima, ditolak, kedaluwarsa, otomatis
  diputuskan_oleh uuid references auth.users(id) on delete set null,
  diputuskan_at timestamptz,
  koreksi jsonb,                      -- perbaikan manusia: bahan belajar ekstraktor
  dibuat_at timestamptz not null default now()
);
create index on public.usulan (perusahaan_id, status, tenggat nulls last, dampak_rp desc nulls last);
create index on public.usulan (berkas_id);
create index on public.usulan (diputuskan_oleh);

-- ===== Bank Tenant: pengetahuan + ekstraktor terkompilasi =====
create table public.pengetahuan (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null,                -- fakta, sop, glosarium, ringkasan, jawaban
  kunci text,                         -- mis. orang:{id}, sop:buka-toko
  isi text not null check (length(isi) <= 20000),
  embedding extensions.halfvec(384),  -- gte-small (gratis di Supabase Edge Runtime)
  versi_data bigint,                  -- untuk membatalkan cache jawaban saat data berubah
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);
create index on public.pengetahuan (perusahaan_id, jenis, kunci);
create index on public.pengetahuan using hnsw (embedding extensions.halfvec_cosine_ops);
create trigger pengetahuan_diubah before update on public.pengetahuan for each row execute function app.set_diubah();

create table public.ekstraktor (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid references public.perusahaan(id) on delete cascade,  -- null = milik bersama (bank publik)
  sidik_tata_letak text not null,
  jenis_berkas text not null,
  aturan jsonb not null,              -- jangkar teks + pola regex per bidang, ditulis LLM sekali
  dipakai integer not null default 0,
  benar integer not null default 0,   -- dipakai tanpa koreksi
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now()
);
create unique index on public.ekstraktor (coalesce(perusahaan_id, '00000000-0000-0000-0000-000000000000'::uuid), sidik_tata_letak);

-- ===== Bank Publik: aturan bertanggal & paket industri (dibaca semua, ditulis hanya lewat migrasi) =====
create table public.aturan_bertanggal (
  id uuid primary key default app.uuid7(),
  kunci text not null,                -- mis. bpjs.jht.pemberi_kerja, ump.bali, pph21.ter.a
  nilai jsonb not null,
  berlaku_dari date not null,
  berlaku_sampai date,
  sumber text not null,
  terverifikasi boolean not null default false,  -- false = ⚠, tidak dipakai sebagai preset
  catatan text
);
create index on public.aturan_bertanggal (kunci, berlaku_dari desc);

create table public.paket_industri (
  kode text primary key,              -- fnb, toko, kantor, bengkel, ...
  nama text not null,
  versi integer not null default 1,
  isi jsonb not null                  -- {topi:[...], tempat:[...], resep_mata:[...], kpi:[...], dokumen:[...]}
);

-- ===== Audit (append-only, dipartisi per bulan) =====
create table public.audit_log (
  id uuid not null default app.uuid7(),
  terjadi_at timestamptz not null default now(),
  perusahaan_id uuid,
  user_id uuid default auth.uid(),
  tabel text not null,
  baris_id uuid,
  aksi text not null,
  sebelum jsonb,
  sesudah jsonb,
  primary key (id, terjadi_at)
) partition by range (terjadi_at);
create index on public.audit_log (perusahaan_id, tabel, baris_id, terjadi_at desc);
create index on public.audit_log using brin (terjadi_at);
select partman.create_parent(
  p_parent_table := 'public.audit_log', p_control := 'terjadi_at', p_interval := '1 month', p_premake := 3);

create or replace function app.catat_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  r := coalesce(new, old);
  insert into public.audit_log (perusahaan_id, tabel, baris_id, aksi, sebelum, sesudah)
  values (r.perusahaan_id, tg_table_name, r.id, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return r;
end $$;
create trigger audit_orang after insert or update or delete on public.orang for each row execute function app.catat_audit();
create trigger audit_pakai_topi after insert or update or delete on public.pakai_topi for each row execute function app.catat_audit();
create trigger audit_usulan after update on public.usulan for each row execute function app.catat_audit();
create or replace function app.catat_audit_rahasia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Nilai sensitif tidak disalin ke audit; cukup siapa dan kapan.
  insert into public.audit_log (perusahaan_id, tabel, baris_id, aksi)
  values (coalesce(new.perusahaan_id, old.perusahaan_id), tg_table_name, coalesce(new.orang_id, old.orang_id), lower(tg_op));
  return coalesce(new, old);
end $$;
create trigger audit_orang_rahasia after insert or update or delete on public.orang_rahasia for each row execute function app.catat_audit_rahasia();

-- ===== RLS =====
do $$
declare t text;
begin
  foreach t in array array['orang','topi','pakai_topi','tempat','aset','kerja','kejadian','berkas','usulan','pengetahuan'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (perusahaan_id = (select app.pid()))', t || '_baca', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (perusahaan_id = (select app.pid()) and (select app.pengelola()))', t || '_tambah', t);
    execute format('create policy %I on public.%I for update to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola())) with check (perusahaan_id = (select app.pid()))', t || '_ubah', t);
    execute format('create policy %I on public.%I for delete to authenticated using (perusahaan_id = (select app.pid()) and (select app.pengelola()))', t || '_hapus', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Staf boleh mengunggah ke Lempar Saja dan melihat berkas/usulan miliknya saja: kebijakan baca berkas dipersempit.
drop policy berkas_baca on public.berkas;
create policy berkas_baca on public.berkas for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.pengelola()) or diunggah_oleh = (select auth.uid())));
drop policy berkas_tambah on public.berkas;
create policy berkas_tambah on public.berkas for insert to authenticated
  with check (perusahaan_id = (select app.pid()) and diunggah_oleh = (select auth.uid()));
drop policy usulan_baca on public.usulan;
create policy usulan_baca on public.usulan for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.prn()) = any(untuk_peran));

-- Kejadian ditulis lewat fungsi (absen dll.) atau pekerja server, bukan langsung oleh klien staf.
-- Data sensitif: hanya pemilik/admin, dan setiap akses tercatat.
alter table public.orang_rahasia enable row level security;
alter table public.orang_rahasia force row level security;
create policy orang_rahasia_kelola on public.orang_rahasia for all to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.pengelola()))
  with check (perusahaan_id = (select app.pid()) and (select app.pengelola()));
revoke all on public.orang_rahasia from anon;

alter table public.ekstraktor enable row level security;
create policy ekstraktor_baca on public.ekstraktor for select to authenticated
  using (perusahaan_id is null or perusahaan_id = (select app.pid()));
revoke all on public.ekstraktor from anon;

alter table public.aturan_bertanggal enable row level security;
create policy aturan_baca on public.aturan_bertanggal for select to authenticated, anon using (true);
alter table public.paket_industri enable row level security;
create policy paket_baca on public.paket_industri for select to authenticated, anon using (true);
revoke insert, update, delete on public.aturan_bertanggal, public.paket_industri, public.ekstraktor from anon, authenticated;

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
create policy audit_baca on public.audit_log for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.prn()) = 'pemilik');
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ===== Hak eksplisit (default privileges sudah dicabut di fondasi) =====
grant select, insert, update, delete on public.orang, public.orang_rahasia, public.topi, public.pakai_topi,
  public.tempat, public.aset, public.kerja, public.berkas, public.usulan, public.pengetahuan to authenticated;
grant select on public.kejadian, public.ekstraktor, public.audit_log to authenticated;
grant select on public.aturan_bertanggal, public.paket_industri to authenticated, anon;
-- Partisi anak tidak pernah diakses langsung lewat API; cabut hak yang mungkin sudah ada.
do $$
declare r record;
begin
  for r in select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid
           join pg_class p on p.oid = i.inhparent
           where p.relname in ('kejadian', 'audit_log') loop
    execute format('revoke all on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
