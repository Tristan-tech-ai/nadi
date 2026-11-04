-- M-02 Produk, stok, gudang (docs/research/mekari/rencana.md, menutup JU-09..JU-11 sebagian; tes supabase/tests/stok.test.sql).
--
-- Model:
--   - produk: barang | jasa | paket (bundle berisi komponen);
--   - satuan tambahan dengan faktor (1 dus = 24 pcs);
--   - varian lewat induk_id + atribut;
--   - harga bertingkat per jumlah minimal.
-- Saldo per produk per gudang ada di public.stok, riwayatnya di public.gerak_stok (tidak diedit; koreksi = gerak baru).
-- Nilai persediaan memakai rata-rata tertimbang bergerak: keluar dinilai nilai/jumlah saat itu, dan keluar terakhir
-- mengambil seluruh sisa nilai supaya tidak ada sisa pembulatan.
-- Setiap gerak yang mengubah nilai memposting jurnal lewat app.posting_jurnal, satu rumus di satu tempat:
--   - masuk: 1-300 persediaan / akun bayar;
--   - keluar karena invoice: 5-100 HPP / 1-300;
--   - selisih opname: 5-200 selisih persediaan.
-- Transfer antargudang tidak memposting jurnal (akun sama).
-- Invoice: baris boleh membawa produk dan satuan. Trigger setelah invoice terbit mengeluarkan stok dari gudang utama;
-- invoice batal mengembalikan stok dan membalik jurnal HPP.

create table public.gudang (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null check (kode ~ '^[A-Z0-9-]{1,12}$'),
  nama text not null check (length(btrim(nama)) between 1 and 60),
  utama boolean not null default false,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kode),
  unique (perusahaan_id, id)
);
create unique index gudang_satu_utama on public.gudang (perusahaan_id) where utama;

create table public.produk (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kode text not null check (kode ~ '^[0-9A-Za-z._-]{1,40}$'),
  nama text not null check (length(btrim(nama)) between 1 and 120),
  jenis text not null default 'barang' check (jenis in ('barang', 'jasa', 'paket')),
  satuan text not null default 'pcs' check (length(btrim(satuan)) between 1 and 20),
  barcode text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  kategori text check (kategori is null or length(kategori) <= 60),
  harga_jual bigint not null default 0 check (harga_jual >= 0),
  harga_tingkat jsonb not null default '[]' check (jsonb_typeof(harga_tingkat) = 'array' and jsonb_array_length(harga_tingkat) <= 10),
  induk_id uuid,
  atribut jsonb not null default '{}' check (jsonb_typeof(atribut) = 'object'),
  boleh_minus boolean not null default false,
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kode),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, induk_id) references public.produk (perusahaan_id, id)
);
create unique index produk_barcode_unik on public.produk (perusahaan_id, barcode) where barcode is not null;
create index on public.produk (induk_id);

create table public.produk_satuan (
  perusahaan_id uuid not null,
  produk_id uuid not null,
  satuan text not null check (length(btrim(satuan)) between 1 and 20),
  faktor numeric(14, 4) not null check (faktor > 0 and faktor <= 100000),
  harga_jual bigint check (harga_jual is null or harga_jual >= 0),
  primary key (produk_id, satuan),
  foreign key (perusahaan_id, produk_id) references public.produk (perusahaan_id, id) on delete cascade
);

create table public.produk_komponen (
  perusahaan_id uuid not null,
  produk_id uuid not null,
  komponen_id uuid not null,
  jumlah numeric(14, 4) not null check (jumlah > 0),
  primary key (produk_id, komponen_id),
  check (produk_id <> komponen_id),
  foreign key (perusahaan_id, produk_id) references public.produk (perusahaan_id, id) on delete cascade,
  foreign key (perusahaan_id, komponen_id) references public.produk (perusahaan_id, id)
);
create index on public.produk_komponen (komponen_id);

create table public.stok (
  perusahaan_id uuid not null,
  produk_id uuid not null,
  gudang_id uuid not null,
  jumlah numeric(18, 4) not null default 0,
  nilai bigint not null default 0,
  diubah_at timestamptz not null default now(),
  primary key (produk_id, gudang_id),
  foreign key (perusahaan_id, produk_id) references public.produk (perusahaan_id, id),
  foreign key (perusahaan_id, gudang_id) references public.gudang (perusahaan_id, id)
);
create index on public.stok (perusahaan_id);
create index on public.stok (gudang_id);

create table public.gerak_stok (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  produk_id uuid not null,
  gudang_id uuid not null,
  tanggal date not null,
  jenis text not null check (jenis in ('masuk', 'keluar', 'transfer', 'penyesuaian', 'balik')),
  jumlah numeric(18, 4) not null check (jumlah <> 0),
  nilai bigint not null,
  saldo_jumlah numeric(18, 4) not null,
  saldo_nilai bigint not null,
  batch text check (batch is null or length(batch) <= 60),
  keterangan text check (keterangan is null or length(keterangan) <= 200),
  sumber text not null default 'manual' check (sumber ~ '^[a-z_.]{1,40}$'),
  sumber_id text check (sumber_id is null or length(sumber_id) <= 100),
  kunci text not null check (length(kunci) between 1 and 200),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci),
  foreign key (perusahaan_id, produk_id) references public.produk (perusahaan_id, id),
  foreign key (perusahaan_id, gudang_id) references public.gudang (perusahaan_id, id)
);
create index on public.gerak_stok (perusahaan_id, produk_id, dibuat_at desc);
create index on public.gerak_stok (gudang_id);
create index on public.gerak_stok (perusahaan_id, sumber, sumber_id);

alter table public.gudang enable row level security;
alter table public.produk enable row level security;
alter table public.produk_satuan enable row level security;
alter table public.produk_komponen enable row level security;
alter table public.stok enable row level security;
alter table public.gerak_stok enable row level security;
-- Daftar produk boleh dibaca semua anggota (kasir dan staf gudang nanti); stok dan riwayat nilainya hanya pengelola.
create policy gudang_baca on public.gudang for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) is not null);
create policy produk_baca on public.produk for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) is not null);
create policy produk_satuan_baca on public.produk_satuan for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) is not null);
create policy produk_komponen_baca on public.produk_komponen for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) is not null);
create policy stok_baca on public.stok for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy gerak_stok_baca on public.gerak_stok for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.gudang, public.produk, public.produk_satuan, public.produk_komponen, public.stok, public.gerak_stok to authenticated;
create trigger audit_produk after insert or update or delete on public.produk for each row execute function app.catat_audit();
create trigger audit_gudang after insert or update or delete on public.gudang for each row execute function app.catat_audit();

create or replace function app.wajib_stok() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengubah produk dan stok' using errcode = '42501';
  end if;
  return v_pid;
end $$;

create or replace function app.gudang_utama(p_pid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.gudang where perusahaan_id = p_pid and utama;
  if v_id is null then
    insert into public.gudang (perusahaan_id, kode, nama, utama)
    values (p_pid, 'UTAMA', 'Gudang utama', not exists (select 1 from public.gudang where perusahaan_id = p_pid and utama))
    on conflict (perusahaan_id, kode) do update set utama = true
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function app.pasang_akun_stok(p_pid uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (p_pid, '1-300', 'Persediaan barang', 'aset', 'debit', true),
         (p_pid, '5-100', 'Harga pokok penjualan', 'beban', 'debit', true),
         (p_pid, '5-200', 'Selisih persediaan', 'beban', 'debit', true)
  on conflict (perusahaan_id, kode) do nothing
$$;

-- Inti satu gerak stok. p_jumlah bertanda. p_nilai: wajib untuk masuk (biaya total); null untuk keluar (dinilai rata-rata).
-- Idempoten per kunci. Mengembalikan {id, nilai, baru}.
create or replace function app.gerak_stok(p_pid uuid, p_produk uuid, p_gudang uuid, p_jumlah numeric, p_nilai bigint, p_jenis text,
  p_tanggal date, p_keterangan text, p_sumber text, p_sumber_id text, p_kunci text, p_batch text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pr public.produk; s public.stok; g public.gerak_stok; v_nilai bigint; v_baru numeric; v_id uuid;
begin
  select * into g from public.gerak_stok where perusahaan_id = p_pid and kunci = p_kunci;
  if found then
    return jsonb_build_object('id', g.id, 'nilai', g.nilai, 'baru', false);
  end if;
  select * into pr from public.produk where id = p_produk and perusahaan_id = p_pid;
  if not found then
    raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
  end if;
  if pr.jenis <> 'barang' then
    raise exception 'Hanya produk jenis barang yang punya stok: %', pr.nama using errcode = '22023';
  end if;
  if not exists (select 1 from public.gudang where id = p_gudang and perusahaan_id = p_pid and aktif) then
    raise exception 'Gudang tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_jumlah is null or p_jumlah = 0 or abs(p_jumlah) > 100000000 then
    raise exception 'Jumlah stok harus selain 0' using errcode = '22023';
  end if;
  insert into public.stok (perusahaan_id, produk_id, gudang_id) values (p_pid, p_produk, p_gudang) on conflict do nothing;
  select * into s from public.stok where produk_id = p_produk and gudang_id = p_gudang for update;
  if p_jumlah > 0 then
    if p_nilai is null then
      -- masuk tanpa biaya (balik, transfer masuk sudah membawa nilai): pakai rata-rata saat ini
      v_nilai := case when s.jumlah > 0 then round(s.nilai::numeric / s.jumlah * p_jumlah)::bigint else 0 end;
    else
      v_nilai := p_nilai;
    end if;
    if v_nilai < 0 then
      raise exception 'Nilai masuk tidak boleh negatif' using errcode = '22023';
    end if;
  else
    if s.jumlah + p_jumlah < 0 and not pr.boleh_minus then
      raise exception 'Stok % tidak cukup: sisa % %, diminta %', pr.nama, trim(to_char(s.jumlah, 'FM999999990.####')), pr.satuan,
        trim(to_char(-p_jumlah, 'FM999999990.####')) using errcode = '23514';
    end if;
    v_nilai := case when s.jumlah <= 0 then 0
                    when s.jumlah + p_jumlah <= 0 then -s.nilai
                    else -round(s.nilai::numeric / s.jumlah * (-p_jumlah))::bigint end;
  end if;
  v_baru := s.jumlah + p_jumlah;
  update public.stok set jumlah = v_baru, nilai = s.nilai + v_nilai, diubah_at = now() where produk_id = p_produk and gudang_id = p_gudang;
  insert into public.gerak_stok (perusahaan_id, produk_id, gudang_id, tanggal, jenis, jumlah, nilai, saldo_jumlah, saldo_nilai, batch,
                                 keterangan, sumber, sumber_id, kunci, dibuat_oleh)
  values (p_pid, p_produk, p_gudang, p_tanggal, p_jenis, p_jumlah, v_nilai, v_baru, s.nilai + v_nilai, nullif(btrim(coalesce(p_batch, '')), ''),
          left(nullif(btrim(coalesce(p_keterangan, '')), ''), 200), p_sumber, p_sumber_id, p_kunci, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nilai', v_nilai, 'baru', true);
end $$;

-- Simpan produk (baru bila p ->> 'id' kosong). Paket membawa komponen [{produk, jumlah}]; satuan tambahan [{satuan, faktor, harga}].
create or replace function public.simpan_produk(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_id uuid := nullif(p ->> 'id', '')::uuid; v_jenis text := coalesce(nullif(p ->> 'jenis', ''), 'barang'); e jsonb;
begin
  if v_id is null then
    insert into public.produk (perusahaan_id, kode, nama, jenis, satuan, barcode, kategori, harga_jual, harga_tingkat, induk_id, atribut, boleh_minus)
    values (v_pid, btrim(p ->> 'kode'), btrim(p ->> 'nama'), v_jenis, coalesce(nullif(btrim(p ->> 'satuan'), ''), 'pcs'),
            nullif(btrim(coalesce(p ->> 'barcode', '')), ''), nullif(btrim(coalesce(p ->> 'kategori', '')), ''),
            coalesce((p ->> 'harga_jual')::bigint, 0), coalesce(p -> 'harga_tingkat', '[]'), nullif(p ->> 'induk', '')::uuid,
            coalesce(p -> 'atribut', '{}'), coalesce((p ->> 'boleh_minus')::boolean, false))
    returning id into v_id;
  else
    update public.produk set kode = btrim(p ->> 'kode'), nama = btrim(p ->> 'nama'), satuan = coalesce(nullif(btrim(p ->> 'satuan'), ''), satuan),
           barcode = nullif(btrim(coalesce(p ->> 'barcode', '')), ''), kategori = nullif(btrim(coalesce(p ->> 'kategori', '')), ''),
           harga_jual = coalesce((p ->> 'harga_jual')::bigint, harga_jual), harga_tingkat = coalesce(p -> 'harga_tingkat', harga_tingkat),
           atribut = coalesce(p -> 'atribut', atribut), boleh_minus = coalesce((p ->> 'boleh_minus')::boolean, boleh_minus),
           aktif = coalesce((p ->> 'aktif')::boolean, aktif)
     where id = v_id and perusahaan_id = v_pid;
    if not found then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;
  end if;
  -- Satuan dan isi paket hanya ditambah atau diubah (tanpa menghapus baris: penjaga data); faktor lama tetap tercatat.
  if p ? 'satuan_lain' then
    for e in select * from jsonb_array_elements(p -> 'satuan_lain') loop
      insert into public.produk_satuan (perusahaan_id, produk_id, satuan, faktor, harga_jual)
      values (v_pid, v_id, btrim(e ->> 'satuan'), (e ->> 'faktor')::numeric, (e ->> 'harga')::bigint)
      on conflict (produk_id, satuan) do update set faktor = excluded.faktor, harga_jual = excluded.harga_jual;
    end loop;
  end if;
  if v_jenis = 'paket' and p ? 'komponen' then
    for e in select * from jsonb_array_elements(p -> 'komponen') loop
      if not exists (select 1 from public.produk where id = (e ->> 'produk')::uuid and perusahaan_id = v_pid and jenis = 'barang') then
        raise exception 'Isi paket harus produk barang milik usaha ini' using errcode = '22023';
      end if;
      insert into public.produk_komponen (perusahaan_id, produk_id, komponen_id, jumlah) values (v_pid, v_id, (e ->> 'produk')::uuid, (e ->> 'jumlah')::numeric)
      on conflict (produk_id, komponen_id) do update set jumlah = excluded.jumlah;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.simpan_gudang(p_kode text, p_nama text, p_utama boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_id uuid; v_pertama boolean;
begin
  v_pertama := not exists (select 1 from public.gudang where perusahaan_id = v_pid and utama);
  if p_utama and not v_pertama then
    update public.gudang set utama = false where perusahaan_id = v_pid and utama;
  end if;
  insert into public.gudang (perusahaan_id, kode, nama, utama) values (v_pid, upper(btrim(p_kode)), btrim(p_nama), p_utama or v_pertama)
  on conflict (perusahaan_id, kode) do update set nama = excluded.nama, utama = public.gudang.utama or excluded.utama
  returning id into v_id;
  return v_id;
end $$;

-- Stok masuk (pembelian, stok awal). Akun lawan: 2-100 utang pemasok (bawaan), 1-100 kas, 1-110 bank, 3-900 penyeimbang saldo awal.
create or replace function public.stok_masuk(p_produk uuid, p_gudang uuid, p_jumlah numeric, p_nilai bigint, p_tanggal date, p_akun text,
  p_keterangan text, p_batch text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_tgl date; r jsonb; v_akun text := coalesce(nullif(p_akun, ''), '2-100'); pr public.produk;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah masuk harus lebih dari 0' using errcode = '22023'; end if;
  if p_nilai is null or p_nilai < 0 then raise exception 'Isi biaya total dalam rupiah bulat (0 bila gratis)' using errcode = '22023'; end if;
  if v_akun not in ('2-100', '1-100', '1-110', '3-900') then raise exception 'Akun bayar tidak dikenal' using errcode = '22023'; end if;
  v_tgl := coalesce(p_tanggal, app.hari_ini(v_pid));
  if v_tgl > app.hari_ini(v_pid) then raise exception 'Tanggal masuk tidak boleh di masa depan' using errcode = '22023'; end if;
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.pasang_akun_stok(v_pid);
  if v_akun = '3-900' then
    insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
    values (v_pid, '3-900', 'Penyeimbang saldo awal', 'modal', 'kredit', true) on conflict (perusahaan_id, kode) do nothing;
  end if;
  select * into pr from public.produk where id = p_produk and perusahaan_id = v_pid;
  r := app.gerak_stok(v_pid, p_produk, coalesce(p_gudang, app.gudang_utama(v_pid)), p_jumlah, p_nilai, 'masuk', v_tgl, p_keterangan,
         'stok_masuk', p_kunci::text, 'masuk:' || p_kunci, p_batch);
  if (r ->> 'baru')::boolean and p_nilai > 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Stok masuk ' || pr.nama, 200),
      'sumber', 'stok', 'sumber_id', r ->> 'id', 'kunci_idempoten', 'stok-masuk:' || p_kunci),
      jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', p_nilai), jsonb_build_object('akun', v_akun, 'kredit', p_nilai)), auth.uid());
  end if;
  return r;
end $$;

create or replace function public.transfer_stok(p_produk uuid, p_dari uuid, p_ke uuid, p_jumlah numeric, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_tgl date; r1 jsonb; r2 jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if p_dari = p_ke then raise exception 'Gudang asal dan tujuan sama' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah pindah harus lebih dari 0' using errcode = '22023'; end if;
  v_tgl := app.hari_ini(v_pid);
  r1 := app.gerak_stok(v_pid, p_produk, p_dari, -p_jumlah, null, 'transfer', v_tgl, 'Pindah gudang', 'transfer', p_kunci::text, 'transfer-keluar:' || p_kunci);
  r2 := app.gerak_stok(v_pid, p_produk, p_ke, p_jumlah, -(r1 ->> 'nilai')::bigint, 'transfer', v_tgl, 'Pindah gudang', 'transfer', p_kunci::text, 'transfer-masuk:' || p_kunci);
  return jsonb_build_object('nilai', -(r1 ->> 'nilai')::bigint, 'baru', (r2 ->> 'baru')::boolean);
end $$;

-- Stok opname satu gudang: p_baris [{produk, fisik, nilai_satuan?}]. Selisih kurang dinilai rata-rata; selisih lebih dinilai
-- rata-rata, atau nilai_satuan bila stok kosong. Satu jurnal selisih per opname.
create or replace function public.opname_stok(p_gudang uuid, p_baris jsonb, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_stok(); v_gudang uuid := coalesce(p_gudang, app.gudang_utama(v_pid)); v_tgl date; e jsonb; s public.stok;
  v_fisik numeric; v_selisih numeric; r jsonb; v_total bigint := 0; n int := 0; i int := 0; v_nilai bigint;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 2000 then
    raise exception 'Isi 1 sampai 2000 baris hitungan' using errcode = '22023';
  end if;
  v_tgl := app.hari_ini(v_pid);
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.pasang_akun_stok(v_pid);
  for e in select * from jsonb_array_elements(p_baris) loop
    i := i + 1;
    v_fisik := (e ->> 'fisik')::numeric;
    if v_fisik is null or v_fisik < 0 then raise exception 'Jumlah fisik baris % tidak sah', i using errcode = '22023'; end if;
    select * into s from public.stok where produk_id = (e ->> 'produk')::uuid and gudang_id = v_gudang;
    v_selisih := v_fisik - coalesce(s.jumlah, 0);
    if v_selisih = 0 then continue; end if;
    v_nilai := case when v_selisih > 0 and coalesce(s.jumlah, 0) <= 0 then round(coalesce((e ->> 'nilai_satuan')::numeric, 0) * v_selisih)::bigint else null end;
    r := app.gerak_stok(v_pid, (e ->> 'produk')::uuid, v_gudang, v_selisih, v_nilai, 'penyesuaian', v_tgl, 'Stok opname', 'opname',
           p_kunci::text, 'opname:' || p_kunci || ':' || (e ->> 'produk'));
    v_total := v_total + (r ->> 'nilai')::bigint;
    n := n + 1;
  end loop;
  if v_total < 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', 'Selisih stok opname', 'sumber', 'stok', 'sumber_id', p_kunci::text,
      'kunci_idempoten', 'opname:' || p_kunci), jsonb_build_array(jsonb_build_object('akun', '5-200', 'debit', -v_total), jsonb_build_object('akun', '1-300', 'kredit', -v_total)), auth.uid());
  elsif v_total > 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', 'Selisih stok opname', 'sumber', 'stok', 'sumber_id', p_kunci::text,
      'kunci_idempoten', 'opname:' || p_kunci), jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_total), jsonb_build_object('akun', '5-200', 'kredit', v_total)), auth.uid());
  end if;
  return jsonb_build_object('berubah', n, 'nilai', v_total);
end $$;

-- Invoice terbit: baris berproduk barang/paket mengeluarkan stok gudang utama dan memposting HPP.
create or replace function app.stok_invoice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e jsonb; pr public.produk; k record; v_faktor numeric; v_jml numeric; v_hpp bigint := 0; r jsonb; v_gudang uuid; i int := 0;
begin
  for e in select * from jsonb_array_elements(new.baris) loop
    i := i + 1;
    continue when e ->> 'produk' is null;
    select * into pr from public.produk where id = (e ->> 'produk')::uuid and perusahaan_id = new.perusahaan_id;
    continue when not found or pr.jenis = 'jasa';
    v_faktor := coalesce((select ps.faktor from public.produk_satuan ps where ps.produk_id = pr.id and ps.satuan = e ->> 'satuan'), 1);
    v_jml := (e ->> 'jumlah')::numeric * v_faktor;
    v_gudang := coalesce(v_gudang, app.gudang_utama(new.perusahaan_id));
    if pr.jenis = 'barang' then
      r := app.gerak_stok(new.perusahaan_id, pr.id, v_gudang, -v_jml, null, 'keluar', new.tanggal, 'Invoice ' || new.nomor, 'invoice',
             new.id::text, 'invoice:' || new.id || ':' || i);
      v_hpp := v_hpp - (r ->> 'nilai')::bigint;
    else
      for k in select c.komponen_id, c.jumlah from public.produk_komponen c where c.produk_id = pr.id loop
        r := app.gerak_stok(new.perusahaan_id, k.komponen_id, v_gudang, -(v_jml * k.jumlah), null, 'keluar', new.tanggal, 'Invoice ' || new.nomor,
               'invoice', new.id::text, 'invoice:' || new.id || ':' || i || ':' || k.komponen_id);
        v_hpp := v_hpp - (r ->> 'nilai')::bigint;
      end loop;
    end if;
  end loop;
  if v_hpp > 0 then
    perform app.pasang_akun_stok(new.perusahaan_id);
    perform app.posting_jurnal(new.perusahaan_id, jsonb_build_object('tanggal', new.tanggal, 'keterangan', left('HPP invoice ' || new.nomor, 200),
      'sumber', 'stok', 'sumber_id', new.id::text, 'kunci_idempoten', 'hpp:' || new.id),
      jsonb_build_array(jsonb_build_object('akun', '5-100', 'debit', v_hpp), jsonb_build_object('akun', '1-300', 'kredit', v_hpp)), auth.uid());
  end if;
  return null;
end $$;
create trigger stok_invoice after insert on public.invoice for each row execute function app.stok_invoice();

-- Invoice batal: stok kembali dengan nilai yang sama saat keluar, jurnal HPP dibalik.
create or replace function app.stok_invoice_batal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g public.gerak_stok; v_j uuid;
begin
  if new.status = 'batal' and old.status <> 'batal' then
    for g in select * from public.gerak_stok where perusahaan_id = new.perusahaan_id and sumber = 'invoice' and sumber_id = new.id::text and jenis = 'keluar' loop
      perform app.gerak_stok(new.perusahaan_id, g.produk_id, g.gudang_id, -g.jumlah, -g.nilai, 'balik', app.hari_ini(new.perusahaan_id),
        'Invoice ' || new.nomor || ' dibatalkan', 'invoice', new.id::text, 'balik:' || g.kunci);
    end loop;
    select id into v_j from public.jurnal where perusahaan_id = new.perusahaan_id and kunci_idempoten = 'hpp:' || new.id and dibalik_oleh is null;
    if v_j is not null then
      perform public.balik_jurnal(v_j, 'Invoice ' || new.nomor || ' dibatalkan');
    end if;
  end if;
  return null;
end $$;
create trigger stok_invoice_batal after update of status on public.invoice for each row execute function app.stok_invoice_batal();

-- buat_invoice: sama dengan versi 20261101027000, ditambah baris boleh membawa produk (milik usaha, aktif) dan satuan.
create or replace function public.buat_invoice(p_pelanggan text, p_hp text, p_baris jsonb, p_jatuh_tempo date, p_catatan text, p_kunci uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_penagih(); v_hari date; v_id uuid; v_total numeric := 0; v_baris jsonb := '[]'::jsonb; e jsonb;
  v_jml numeric; v_hrg numeric; v_uraian text; r jsonb; v_kode text; v_jurnal jsonb; i int; v_off int[] := array[-3, 0, 3, 14];
  inv public.invoice; v_produk uuid; v_satuan text; v_el jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into inv from public.invoice where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then
    return jsonb_build_object('id', inv.id, 'nomor', inv.nomor, 'kode', inv.kode_verifikasi, 'total', inv.total, 'sudah', true);
  end if;
  v_hari := app.hari_ini(v_pid);
  if length(btrim(coalesce(p_pelanggan, ''))) not between 1 and 100 then
    raise exception 'Tulis nama pelanggan (paling panjang 100 huruf).' using errcode = '22023';
  end if;
  if p_jatuh_tempo is null or p_jatuh_tempo < v_hari or p_jatuh_tempo > v_hari + 365 then
    raise exception 'Jatuh tempo mulai hari ini sampai setahun ke depan.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 30 then
    raise exception 'Isi 1 sampai 30 baris barang atau jasa.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    v_uraian := btrim(coalesce(e ->> 'uraian', ''));
    begin
      v_jml := (e ->> 'jumlah')::numeric;
      v_hrg := (e ->> 'harga')::numeric;
      v_produk := nullif(e ->> 'produk', '')::uuid;
    exception when others then
      raise exception 'Jumlah dan harga harus angka.' using errcode = '22023';
    end;
    if length(v_uraian) not between 1 and 120 or v_jml is null or v_jml <= 0 or v_jml > 100000 or v_hrg is null or v_hrg < 0
       or v_hrg <> trunc(v_hrg) or v_hrg > 1000000000000 then
      raise exception 'Setiap baris butuh uraian, jumlah lebih dari 0, dan harga rupiah bulat.' using errcode = '22023';
    end if;
    v_total := v_total + round(v_jml * v_hrg);
    v_el := jsonb_build_object('uraian', v_uraian, 'jumlah', v_jml, 'harga', v_hrg::bigint);
    if v_produk is not null then
      select coalesce(nullif(btrim(e ->> 'satuan'), ''), p.satuan) into v_satuan from public.produk p where p.id = v_produk and p.perusahaan_id = v_pid and p.aktif;
      if not found then
        raise exception 'Produk di baris "%" tidak ditemukan di usaha ini.', v_uraian using errcode = '22023';
      end if;
      if v_satuan <> (select p.satuan from public.produk p where p.id = v_produk)
         and not exists (select 1 from public.produk_satuan ps where ps.produk_id = v_produk and ps.satuan = v_satuan) then
        raise exception 'Satuan % tidak dikenal untuk produk di baris "%".', v_satuan, v_uraian using errcode = '22023';
      end if;
      v_el := v_el || jsonb_build_object('produk', v_produk, 'satuan', v_satuan);
    end if;
    v_baris := v_baris || jsonb_build_array(v_el);
  end loop;
  if v_total <= 0 then raise exception 'Total tagihan masih Rp0.' using errcode = '22023'; end if;
  if p_hp is not null and btrim(p_hp) <> '' and btrim(p_hp) !~ '^62[0-9]{8,13}$' then
    raise exception 'Nomor WhatsApp pelanggan belum benar.' using errcode = '22023';
  end if;

  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, 'INV', 'Invoice', '{no:3}/INV/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  v_id := app.uuid7();
  r := app.terbit_nomor(v_pid, 'INV', 'invoice ' || v_id, auth.uid());
  v_kode := app.kode_verifikasi();
  v_jurnal := app.posting_jurnal(v_pid,
    jsonb_build_object('tanggal', v_hari, 'keterangan', left('Invoice ' || (r ->> 'nomor') || ' ' || btrim(p_pelanggan), 200),
                       'sumber', 'invoice', 'sumber_id', v_id::text, 'kunci_idempoten', 'invoice:' || v_id),
    jsonb_build_array(jsonb_build_object('akun', '1-200', 'debit', v_total), jsonb_build_object('akun', '4-100', 'kredit', v_total)),
    auth.uid());
  insert into public.invoice (id, perusahaan_id, nomor, nomor_terbit_id, kode_verifikasi, pelanggan, pelanggan_hp, baris, total, tanggal,
                              jatuh_tempo, catatan, jurnal_terbit, kunci_klien, dibuat_oleh)
  values (v_id, v_pid, r ->> 'nomor', (r ->> 'id')::uuid, v_kode, btrim(p_pelanggan), nullif(btrim(coalesce(p_hp, '')), ''), v_baris,
          v_total::bigint, v_hari, p_jatuh_tempo, nullif(left(btrim(coalesce(p_catatan, '')), 300), ''), (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid());
  for i in 1..4 loop
    if p_jatuh_tempo + v_off[i] >= v_hari then
      insert into public.pengingat_invoice (perusahaan_id, invoice_id, tahap, tanggal) values (v_pid, v_id, i, p_jatuh_tempo + v_off[i]);
    end if;
  end loop;
  return jsonb_build_object('id', v_id, 'nomor', r ->> 'nomor', 'kode', v_kode, 'total', v_total::bigint, 'sudah', false);
end $$;

revoke all on function app.wajib_stok(), app.gudang_utama(uuid), app.pasang_akun_stok(uuid),
  app.gerak_stok(uuid, uuid, uuid, numeric, bigint, text, date, text, text, text, text, text), app.stok_invoice(), app.stok_invoice_batal()
  from public, anon, authenticated;
revoke all on function public.simpan_produk(jsonb), public.simpan_gudang(text, text, boolean),
  public.stok_masuk(uuid, uuid, numeric, bigint, date, text, text, text, uuid), public.transfer_stok(uuid, uuid, uuid, numeric, uuid),
  public.opname_stok(uuid, jsonb, uuid) from public, anon;
grant execute on function public.simpan_produk(jsonb), public.simpan_gudang(text, text, boolean),
  public.stok_masuk(uuid, uuid, numeric, bigint, date, text, text, text, uuid), public.transfer_stok(uuid, uuid, uuid, numeric, uuid),
  public.opname_stok(uuid, jsonb, uuid) to authenticated;
