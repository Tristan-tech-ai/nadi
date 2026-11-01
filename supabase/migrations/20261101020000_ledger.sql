-- F4-04 Ledger (docs/research/ledger.md, rencana uji docs/quality/rencana-uji-f4-04.md, tes supabase/tests/ledger.test.sql).
-- Angka yang sudah dibukukan tidak bisa diam-diam berubah: jurnal dan barisnya tidak bisa diedit atau dihapus, salah dibetulkan
-- dengan jurnal balik. Keseimbangan (debit = kredit, minimal dua baris) dijaga constraint trigger AFTER ROW DEFERRABLE INITIALLY
-- DEFERRED (docs PostgreSQL CREATE TRIGGER), sehingga jalur tulis mana pun diperiksa di akhir transaksi; posting_jurnal memaksa
-- pemeriksaan itu di dalam RPC lewat SET CONSTRAINTS ... IMMEDIATE (berlaku surut, docs SET CONSTRAINTS) lalu DEFERRED lagi.
-- Posting idempoten per kunci_idempoten (unik per usaha). Bulan terkunci menolak jurnal; hanya bulan yang sudah lewat menurut
-- zona usaha yang bisa dikunci, jadi jurnal balik (selalu bertanggal hari ini) tidak pernah jatuh di bulan terkunci.
-- Bagan akun bawaan adalah pilihan Nadi sebagai data per usaha yang bisa diubah, bukan daftar resmi dari standar mana pun.
-- Peran lewat app.peran_aktif() (tabel anggota). Catatan: menghapus perusahaan yang punya jurnal akan ditolak trigger jaga.

create table public.akun (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null check (kode ~ '^[0-9A-Za-z.-]{1,20}$'),
  nama text not null check (length(btrim(nama)) between 1 and 80),
  golongan text not null check (golongan in ('aset', 'kewajiban', 'modal', 'pendapatan', 'beban')),
  saldo_normal text not null check (saldo_normal in ('debit', 'kredit')),
  aktif boolean not null default true,
  bawaan boolean not null default false,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kode),
  unique (perusahaan_id, id)
);

create table public.jurnal (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tanggal date not null,
  keterangan text not null check (length(btrim(keterangan)) between 1 and 200),
  sumber text not null default 'manual' check (sumber ~ '^[a-z_.]{1,40}$'),
  sumber_id text check (sumber_id is null or length(sumber_id) <= 100),
  kunci_idempoten text check (kunci_idempoten is null or length(kunci_idempoten) between 1 and 200),
  membalik uuid references public.jurnal(id),
  dibalik_oleh uuid references public.jurnal(id),
  alasan_balik text check (alasan_balik is null or length(alasan_balik) <= 300),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_idempoten),
  unique (perusahaan_id, id)
);
create index on public.jurnal (perusahaan_id, tanggal desc);
create index on public.jurnal (membalik);
create index on public.jurnal (dibalik_oleh);

create table public.jurnal_baris (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  jurnal_id uuid not null,
  akun_id uuid not null,
  debit bigint not null default 0 check (debit >= 0),
  kredit bigint not null default 0 check (kredit >= 0),
  keterangan text check (keterangan is null or length(keterangan) <= 200),
  check ((debit > 0) <> (kredit > 0)),
  foreign key (perusahaan_id, jurnal_id) references public.jurnal (perusahaan_id, id),
  foreign key (perusahaan_id, akun_id) references public.akun (perusahaan_id, id)
);
create index on public.jurnal_baris (jurnal_id);
create index on public.jurnal_baris (perusahaan_id, akun_id);

create table public.periode_buku (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  terkunci boolean not null default true,
  terkunci_at timestamptz,
  terkunci_oleh uuid,
  dibuka_at timestamptz,
  dibuka_oleh uuid,
  alasan_buka text check (alasan_buka is null or length(alasan_buka) <= 300),
  unique (perusahaan_id, bulan)
);

alter table public.akun enable row level security;
alter table public.jurnal enable row level security;
alter table public.jurnal_baris enable row level security;
alter table public.periode_buku enable row level security;
create policy akun_baca on public.akun for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy jurnal_baca on public.jurnal for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy jurnal_baris_baca on public.jurnal_baris for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy periode_buku_baca on public.periode_buku for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.akun, public.jurnal, public.jurnal_baris, public.periode_buku to authenticated;
create trigger audit_akun after insert or update or delete on public.akun for each row execute function app.catat_audit();
create trigger audit_periode_buku after insert or update or delete on public.periode_buku for each row execute function app.catat_audit();

-- Keseimbangan: diperiksa di akhir transaksi (atau saat SET CONSTRAINTS IMMEDIATE).
create or replace function app.cek_jurnal_seimbang() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_jurnal uuid := coalesce(new.jurnal_id, old.jurnal_id); d bigint; k bigint; n int;
begin
  select coalesce(sum(b.debit), 0), coalesce(sum(b.kredit), 0), count(*) into d, k, n from public.jurnal_baris b where b.jurnal_id = v_jurnal;
  if n = 0 then
    return null;
  end if;
  if n < 2 then
    raise exception 'Jurnal butuh minimal dua baris' using errcode = '23514';
  end if;
  if d <> k then
    raise exception 'Jurnal tidak seimbang: debit % dan kredit %', d, k using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger jurnal_baris_seimbang after insert or update or delete on public.jurnal_baris
  deferrable initially deferred for each row execute function app.cek_jurnal_seimbang();

create or replace function app.cek_jurnal_berbaris() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.jurnal_baris b where b.jurnal_id = new.id) < 2 then
    raise exception 'Jurnal butuh minimal dua baris' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger jurnal_berbaris after insert on public.jurnal
  deferrable initially deferred for each row execute function app.cek_jurnal_berbaris();

-- Tidak bisa diedit: hanya penanda dibalik_oleh/alasan_balik yang boleh diisi sekali.
create or replace function app.jaga_jurnal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'jurnal' and old.dibalik_oleh is null and new.dibalik_oleh is not null
     and (to_jsonb(new) - 'dibalik_oleh' - 'alasan_balik') = (to_jsonb(old) - 'dibalik_oleh' - 'alasan_balik') then
    return new;
  end if;
  raise exception 'Jurnal yang sudah dibukukan tidak bisa diubah atau dihapus. Betulkan dengan jurnal balik.' using errcode = '42501';
end $$;
create trigger jaga_jurnal before update or delete on public.jurnal for each row execute function app.jaga_jurnal();
create trigger jaga_jurnal_baris before update or delete on public.jurnal_baris for each row execute function app.jaga_jurnal();

-- Bulan terkunci menolak jurnal.
create or replace function app.jaga_periode_jurnal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.periode_buku p where p.perusahaan_id = new.perusahaan_id
              and p.bulan = date_trunc('month', new.tanggal)::date and p.terkunci) then
    raise exception 'Buku bulan % sudah dikunci. Minta pemilik atau akuntan membukanya dengan alasan.', to_char(new.tanggal, 'MM/YYYY') using errcode = '55000';
  end if;
  return new;
end $$;
create trigger jaga_periode_jurnal before insert on public.jurnal for each row execute function app.jaga_periode_jurnal();

-- Bagan akun bawaan (pilihan Nadi; nama sehari-hari dengan istilah akuntansi sebagai keterangan kedua).
create or replace function app.pasang_bagan_bawaan(p_pid uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  select p_pid, b.kode, b.nama, b.golongan, b.saldo_normal, true
    from (values
      ('1-100', 'Kas', 'aset', 'debit'),
      ('1-110', 'Bank', 'aset', 'debit'),
      ('1-200', 'Tagihan belum dibayar pelanggan (piutang)', 'aset', 'debit'),
      ('1-300', 'Persediaan barang', 'aset', 'debit'),
      ('1-500', 'Peralatan', 'aset', 'debit'),
      ('2-100', 'Utang ke pemasok', 'kewajiban', 'kredit'),
      ('2-200', 'Gaji belum dibayar', 'kewajiban', 'kredit'),
      ('2-300', 'Pajak belum disetor', 'kewajiban', 'kredit'),
      ('3-100', 'Modal pemilik', 'modal', 'kredit'),
      ('3-200', 'Diambil untuk pribadi (prive)', 'modal', 'debit'),
      ('4-100', 'Penjualan', 'pendapatan', 'kredit'),
      ('4-900', 'Pendapatan lain', 'pendapatan', 'kredit'),
      ('5-100', 'Harga pokok penjualan', 'beban', 'debit'),
      ('6-100', 'Gaji', 'beban', 'debit'),
      ('6-200', 'Sewa', 'beban', 'debit'),
      ('6-300', 'Listrik, air, internet', 'beban', 'debit'),
      ('6-900', 'Beban lain', 'beban', 'debit')
    ) as b(kode, nama, golongan, saldo_normal)
  on conflict (perusahaan_id, kode) do nothing
$$;

-- Inti posting (dipakai RPC dan nanti oleh alur invoice/gaji). Kepala: tanggal?, keterangan, sumber?, sumber_id?, kunci_idempoten?.
-- Baris: [{akun: kode, debit|kredit: rupiah bulat, keterangan?}].
create or replace function app.posting_jurnal(p_pid uuid, p_kepala jsonb, p_baris jsonb, p_oleh uuid, p_membalik uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_kunci text := nullif(btrim(p_kepala ->> 'kunci_idempoten'), '');
  v_tgl date; v_id uuid; v_akun uuid; e jsonb; v_d numeric; v_k numeric;
begin
  if jsonb_typeof(p_baris) is distinct from 'array' then
    raise exception 'Baris jurnal harus berupa daftar' using errcode = '22023';
  end if;
  if not exists (select 1 from public.akun a where a.perusahaan_id = p_pid) then
    perform app.pasang_bagan_bawaan(p_pid);
  end if;
  if v_kunci is not null then
    select j.id into v_id from public.jurnal j where j.perusahaan_id = p_pid and j.kunci_idempoten = v_kunci;
    if found then
      return jsonb_build_object('id', v_id, 'baru', false);
    end if;
  end if;
  v_tgl := coalesce(app.tanggal_teks(p_kepala ->> 'tanggal'), app.hari_ini(p_pid));
  insert into public.jurnal (perusahaan_id, tanggal, keterangan, sumber, sumber_id, kunci_idempoten, membalik, dibuat_oleh)
  values (p_pid, v_tgl, btrim(coalesce(p_kepala ->> 'keterangan', '')), coalesce(nullif(p_kepala ->> 'sumber', ''), 'manual'),
          nullif(p_kepala ->> 'sumber_id', ''), v_kunci, p_membalik, p_oleh)
  on conflict (perusahaan_id, kunci_idempoten) do nothing
  returning id into v_id;
  if v_id is null then
    -- Permintaan bersamaan dengan kunci sama: yang kalah menunggu yang menang lalu memakai jurnalnya.
    select j.id into v_id from public.jurnal j where j.perusahaan_id = p_pid and j.kunci_idempoten = v_kunci;
    return jsonb_build_object('id', v_id, 'baru', false);
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    -- Akun nonaktif hanya boleh dipakai untuk membalik jurnal lama.
    select a.id into v_akun from public.akun a where a.perusahaan_id = p_pid and a.kode = e ->> 'akun' and (a.aktif or p_membalik is not null);
    if not found then
      raise exception 'Akun % tidak ada di bagan akun usaha ini', coalesce(e ->> 'akun', '(kosong)') using errcode = 'P0002';
    end if;
    v_d := coalesce((e ->> 'debit')::numeric, 0);
    v_k := coalesce((e ->> 'kredit')::numeric, 0);
    if v_d <> trunc(v_d) or v_k <> trunc(v_k) or v_d < 0 or v_k < 0 then
      raise exception 'Nilai jurnal dalam rupiah bulat, tidak negatif' using errcode = '22023';
    end if;
    insert into public.jurnal_baris (perusahaan_id, jurnal_id, akun_id, debit, kredit, keterangan)
    values (p_pid, v_id, v_akun, v_d::bigint, v_k::bigint, left(nullif(btrim(e ->> 'keterangan'), ''), 200));
  end loop;
  set constraints public.jurnal_baris_seimbang, public.jurnal_berbaris immediate;
  set constraints public.jurnal_baris_seimbang, public.jurnal_berbaris deferred;
  return jsonb_build_object('id', v_id, 'baru', true);
end $$;

create or replace function public.posting_jurnal(p_kepala jsonb, p_baris jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang membukukan jurnal' using errcode = '42501';
  end if;
  return app.posting_jurnal(v_pid, p_kepala, p_baris, auth.uid());
end $$;

-- Jurnal balik: selalu bertanggal hari ini (bulan berjalan, tidak pernah terkunci), idempoten per jurnal asli.
create or replace function public.balik_jurnal(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); j public.jurnal; v_baris jsonb; r jsonb;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang membalik jurnal' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan jurnal dibalik' using errcode = '22023';
  end if;
  select * into j from public.jurnal where id = p_id and perusahaan_id = v_pid for update;
  if not found then
    raise exception 'Jurnal tidak ditemukan' using errcode = 'P0002';
  end if;
  if j.dibalik_oleh is not null then
    return jsonb_build_object('id', j.dibalik_oleh, 'baru', false);
  end if;
  if j.membalik is not null then
    raise exception 'Jurnal ini sendiri jurnal balik; catat jurnal baru bila perlu' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('akun', a.kode, 'debit', b.kredit, 'kredit', b.debit, 'keterangan', b.keterangan) order by b.id)
    into v_baris from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.jurnal_id = j.id;
  r := app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Balik: ' || j.keterangan, 200), 'sumber', 'balik',
         'sumber_id', j.id::text, 'kunci_idempoten', 'balik:' || j.id), v_baris, auth.uid(), j.id);
  update public.jurnal set dibalik_oleh = (r ->> 'id')::uuid, alasan_balik = left(btrim(p_alasan), 300) where id = j.id;
  return r;
end $$;

create or replace function public.kunci_periode(p_bulan date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_bulan date := date_trunc('month', p_bulan)::date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'akuntan') then
    raise exception 'Hanya pemilik atau akuntan yang mengunci buku' using errcode = '42501';
  end if;
  if v_bulan is null or v_bulan >= date_trunc('month', app.hari_ini(v_pid))::date then
    raise exception 'Hanya bulan yang sudah lewat yang bisa dikunci' using errcode = '22023';
  end if;
  insert into public.periode_buku (perusahaan_id, bulan, terkunci, terkunci_at, terkunci_oleh)
  values (v_pid, v_bulan, true, now(), auth.uid())
  on conflict (perusahaan_id, bulan) do update set terkunci = true, terkunci_at = now(), terkunci_oleh = auth.uid()
  where not public.periode_buku.terkunci;
end $$;

create or replace function public.buka_periode(p_bulan date, p_alasan text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'akuntan') then
    raise exception 'Hanya pemilik atau akuntan yang membuka kunci buku' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alasan, ''))) < 5 then
    raise exception 'Tulis alasan membuka kunci buku' using errcode = '22023';
  end if;
  update public.periode_buku set terkunci = false, dibuka_at = now(), dibuka_oleh = auth.uid(), alasan_buka = left(btrim(p_alasan), 300)
   where perusahaan_id = v_pid and bulan = date_trunc('month', p_bulan)::date and terkunci;
  if not found then
    raise exception 'Bulan itu tidak sedang dikunci' using errcode = 'P0002';
  end if;
end $$;

revoke all on function app.cek_jurnal_seimbang(), app.cek_jurnal_berbaris(), app.jaga_jurnal(), app.jaga_periode_jurnal(),
  app.pasang_bagan_bawaan(uuid), app.posting_jurnal(uuid, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.posting_jurnal(jsonb, jsonb), public.balik_jurnal(uuid, text), public.kunci_periode(date),
  public.buka_periode(date, text) from public, anon;
grant execute on function public.posting_jurnal(jsonb, jsonb), public.balik_jurnal(uuid, text), public.kunci_periode(date),
  public.buka_periode(date, text) to authenticated;
