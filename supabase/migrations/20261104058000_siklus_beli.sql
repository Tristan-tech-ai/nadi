-- M-04 Siklus pembelian dan hutang (docs/research/mekari/rencana.md, menutup JU-06, JU-07, JU-08, EX-05; tes
-- supabase/tests/siklus_beli.test.sql).
--
-- Alur dokumen: permintaan (PR) > pesanan pembelian (PO) > penerimaan barang (GRN) > tagihan pemasok > pembayaran.
--
-- Jurnal per tahap:
--   - PR dan PO: tanpa jurnal;
--   - penerimaan: baris berproduk masuk stok senilai harga PO; 1-300 persediaan / 2-150 barang diterima belum ditagih;
--   - tagihan dari penerimaan (three-way match):
--       2-150 sebesar nilai penerimaan,
--       akun biaya untuk baris tanpa produk,
--       selisih tagihan dengan PO ke 6-900 (dicatat di kolom selisih dan ditampilkan),
--       lawannya 2-100 utang ke pemasok;
--   - tagihan tanpa PO (nota Lempar yang disetujui, atau tagihan manual): akun biaya (bawaan 6-900) / 2-100;
--   - pembayaran (boleh sebagian): 2-100 / kas atau bank;
--   - retur ke pemasok (nota debit): stok keluar senilai rata-rata;
--       2-100 sebesar harga beli / 1-300 sebesar nilai rata-rata,
--       selisihnya ke 5-200.
-- Hutang = saldo 2-100 = jumlah sisa tagihan terbuka (diuji).
--
-- Usulan nota (uang.keluar) dan tagihan pemasok (uang.tagihan) dari Lempar:
--   - saat dibuat: dicocokkan ke PO terbuka dengan nama pemasok mirip (pg_trgm >= 0,6); penjelasan menyebut nomor PO dan selisihnya;
--   - saat disetujui: menjadi tagihan_beli. Ini menyambungkan nota ke buku besar.

create table public.dokumen_beli (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('permintaan', 'pesanan_beli', 'penerimaan')),
  nomor text not null,
  nomor_terbit_id uuid not null references public.nomor_terbit(id),
  induk_id uuid,
  pemasok text not null check (length(btrim(pemasok)) between 1 and 100),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 30),
  total bigint not null check (total > 0),
  tanggal date not null,
  status text not null default 'terbit' check (status in ('terbit', 'selesai', 'batal')),
  catatan text check (catatan is null or length(catatan) <= 300),
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, induk_id) references public.dokumen_beli (perusahaan_id, id)
);
create index on public.dokumen_beli (perusahaan_id, dibuat_at desc);
create index on public.dokumen_beli (induk_id);

create table public.tagihan_beli (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  pemasok text not null check (length(btrim(pemasok)) between 1 and 100),
  nomor_pemasok text check (nomor_pemasok is null or length(nomor_pemasok) <= 60),
  tanggal date not null,
  jatuh_tempo date not null,
  total bigint not null check (total > 0),
  terbayar bigint not null default 0 check (terbayar >= 0),
  dikurangi bigint not null default 0 check (dikurangi >= 0),
  status text not null default 'terbuka' check (status in ('terbuka', 'lunas', 'batal')),
  dokumen_id uuid,
  usulan_id uuid unique,
  selisih bigint not null default 0,
  akun_beban text not null default '6-900',
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, dokumen_id) references public.dokumen_beli (perusahaan_id, id),
  check (terbayar + dikurangi <= total)
);
create index on public.tagihan_beli (perusahaan_id, status, jatuh_tempo);
create index on public.tagihan_beli (dokumen_id);

create table public.bayar_beli (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  tagihan_id uuid not null,
  jumlah bigint not null check (jumlah > 0),
  cara text not null check (cara in ('tunai', 'transfer')),
  tanggal date not null,
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  foreign key (perusahaan_id, tagihan_id) references public.tagihan_beli (perusahaan_id, id)
);
create index on public.bayar_beli (tagihan_id);

create table public.retur_beli (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  tagihan_id uuid not null,
  nomor text not null,
  produk_id uuid not null,
  jumlah numeric(18, 4) not null check (jumlah > 0),
  nilai bigint not null check (nilai > 0),
  nilai_stok bigint not null,
  alasan text not null check (length(btrim(alasan)) between 3 and 300),
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  foreign key (perusahaan_id, tagihan_id) references public.tagihan_beli (perusahaan_id, id)
);
create index on public.retur_beli (tagihan_id);

alter table public.dokumen_beli enable row level security;
alter table public.tagihan_beli enable row level security;
alter table public.bayar_beli enable row level security;
alter table public.retur_beli enable row level security;
create policy dokumen_beli_baca on public.dokumen_beli for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy tagihan_beli_baca on public.tagihan_beli for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy bayar_beli_baca on public.bayar_beli for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy retur_beli_baca on public.retur_beli for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.dokumen_beli, public.tagihan_beli, public.bayar_beli, public.retur_beli to authenticated;
create trigger audit_dokumen_beli after insert or update or delete on public.dokumen_beli for each row execute function app.catat_audit();
create trigger audit_tagihan_beli after insert or update or delete on public.tagihan_beli for each row execute function app.catat_audit();

create or replace function app.wajib_beli() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin') then
    raise exception 'Hanya pemilik atau admin yang mengurus pembelian' using errcode = '42501';
  end if;
  return v_pid;
end $$;

create or replace function public.buat_dokumen_beli(p_jenis text, p_induk uuid, p_pemasok text, p_baris jsonb, p_catatan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_beli(); d public.dokumen_beli; ind public.dokumen_beli; rb record; v_kode text; r jsonb; e jsonb; i int := 0;
  v_stok bigint := 0; g jsonb; v_jurnal jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into d from public.dokumen_beli where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', d.id, 'nomor', d.nomor, 'total', d.total, 'sudah', true); end if;
  if p_jenis not in ('permintaan', 'pesanan_beli', 'penerimaan') then raise exception 'Jenis dokumen tidak dikenal' using errcode = '22023'; end if;
  if p_induk is not null then
    select * into ind from public.dokumen_beli where id = p_induk and perusahaan_id = v_pid for update;
    if not found then raise exception 'Dokumen asal tidak ditemukan' using errcode = 'P0002'; end if;
    if ind.status <> 'terbit' then raise exception 'Dokumen asal sudah selesai atau dibatalkan' using errcode = '22023'; end if;
    if not ((p_jenis = 'pesanan_beli' and ind.jenis = 'permintaan') or (p_jenis = 'penerimaan' and ind.jenis = 'pesanan_beli')) then
      raise exception 'Urutan dokumen: permintaan, lalu pesanan pembelian, lalu penerimaan barang' using errcode = '22023';
    end if;
  elsif p_jenis = 'penerimaan' then
    raise exception 'Penerimaan barang dibuat dari pesanan pembelian' using errcode = '22023';
  end if;
  select * into rb from app.rapikan_baris_jual(v_pid, coalesce(p_baris, ind.baris));
  v_kode := case p_jenis when 'permintaan' then 'PR' when 'pesanan_beli' then 'PO' else 'GRN' end;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, v_kode, case p_jenis when 'permintaan' then 'Permintaan pembelian' when 'pesanan_beli' then 'Pesanan pembelian' else 'Penerimaan barang' end,
          '{no:3}/' || v_kode || '/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, v_kode, p_jenis || ' ' || p_kunci, auth.uid());
  insert into public.dokumen_beli (perusahaan_id, jenis, nomor, nomor_terbit_id, induk_id, pemasok, baris, total, tanggal, catatan, kunci_klien, dibuat_oleh)
  values (v_pid, p_jenis, r ->> 'nomor', (r ->> 'id')::uuid, p_induk, coalesce(nullif(btrim(coalesce(p_pemasok, '')), ''), ind.pemasok), rb.baris, rb.total,
          app.hari_ini(v_pid), nullif(left(btrim(coalesce(p_catatan, '')), 300), ''), p_kunci, auth.uid())
  returning * into d;
  if d.pemasok is null then raise exception 'Tulis nama pemasok' using errcode = '22023'; end if;
  if p_jenis = 'penerimaan' then
    -- Barang berproduk masuk stok gudang utama senilai harga PO.
    for e in select * from jsonb_array_elements(d.baris) loop
      i := i + 1;
      continue when e ->> 'produk' is null;
      continue when (select p.jenis from public.produk p where p.id = (e ->> 'produk')::uuid) <> 'barang';
      g := app.gerak_stok(v_pid, (e ->> 'produk')::uuid, app.gudang_utama(v_pid), (e ->> 'jumlah')::numeric,
             round((e ->> 'jumlah')::numeric * (e ->> 'harga')::numeric)::bigint, 'masuk', d.tanggal, 'Penerimaan ' || d.nomor, 'pembelian', d.id::text, 'grn:' || d.id || ':' || i);
      v_stok := v_stok + (g ->> 'nilai')::bigint;
    end loop;
    if v_stok > 0 then
      perform app.pasang_bagan_bawaan(v_pid);
      perform app.pasang_akun_stok(v_pid);
      perform app.akun_pastikan(v_pid, '2-150', 'Barang diterima belum ditagih', 'kewajiban', 'kredit');
      v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Penerimaan ' || d.nomor || ' ' || d.pemasok, 200), 'sumber', 'pembelian',
        'sumber_id', d.id::text, 'kunci_idempoten', 'grn:' || d.id),
        jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_stok), jsonb_build_object('akun', '2-150', 'kredit', v_stok)), auth.uid());
      update public.dokumen_beli set jurnal_id = (v_jurnal ->> 'id')::uuid where id = d.id;
    end if;
    update public.dokumen_beli set status = 'selesai' where id = ind.id;
  elsif p_jenis = 'pesanan_beli' and p_induk is not null then
    update public.dokumen_beli set status = 'selesai' where id = ind.id;
  end if;
  return jsonb_build_object('id', d.id, 'nomor', d.nomor, 'total', d.total, 'nilai_stok', v_stok, 'sudah', false);
end $$;

-- Inti tagihan pemasok: dari penerimaan (three-way match) atau tanpa dokumen (akun biaya).
create or replace function app.buat_tagihan_beli(p_pid uuid, p_pemasok text, p_nomor text, p_tanggal date, p_jatuh_tempo date, p_total bigint,
  p_dokumen uuid, p_usulan uuid, p_akun text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.tagihan_beli; d public.dokumen_beli; po public.dokumen_beli; v_akun text := coalesce(nullif(p_akun, ''), '6-900'); v_terima bigint := 0;
  v_lain bigint := 0; v_selisih bigint := 0; v_baris jsonb; v_jurnal jsonb; v_tgl date := coalesce(p_tanggal, app.hari_ini(p_pid));
begin
  select * into t from public.tagihan_beli where perusahaan_id = p_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', t.id, 'sudah', true); end if;
  if p_total is null or p_total <= 0 then raise exception 'Total tagihan harus lebih dari 0' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_pemasok, ''))) not between 1 and 100 then raise exception 'Tulis nama pemasok' using errcode = '22023'; end if;
  if not exists (select 1 from public.akun a where a.perusahaan_id = p_pid and a.kode = v_akun and a.golongan in ('beban', 'aset') and a.aktif)
     and v_akun <> '6-900' then
    raise exception 'Akun biaya % tidak ada atau bukan akun beban/aset', v_akun using errcode = '22023';
  end if;
  perform app.pasang_bagan_bawaan(p_pid);
  perform app.akun_pastikan(p_pid, '2-150', 'Barang diterima belum ditagih', 'kewajiban', 'kredit');
  if p_dokumen is not null then
    select * into d from public.dokumen_beli where id = p_dokumen and perusahaan_id = p_pid;
    if not found or d.jenis <> 'penerimaan' then raise exception 'Tagihan dicocokkan ke penerimaan barang' using errcode = '22023'; end if;
    if exists (select 1 from public.tagihan_beli x where x.dokumen_id = d.id and x.status <> 'batal') then
      raise exception 'Penerimaan % sudah punya tagihan', d.nomor using errcode = '23505';
    end if;
    select coalesce(sum(b.debit), 0) into v_terima from public.jurnal_baris b join public.akun a on a.id = b.akun_id
     where b.jurnal_id = d.jurnal_id and a.kode = '1-300';
    select * into po from public.dokumen_beli where id = d.induk_id;
    v_lain := d.total - v_terima;
    v_selisih := p_total - d.total;
    v_baris := jsonb_build_array(jsonb_build_object('akun', '2-100', 'kredit', p_total));
    if v_terima > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '2-150', 'debit', v_terima)); end if;
    if v_lain > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', v_akun, 'debit', v_lain)); end if;
    if v_selisih > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '6-900', 'debit', v_selisih));
    elsif v_selisih < 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '6-900', 'kredit', -v_selisih)); end if;
  else
    v_baris := jsonb_build_array(jsonb_build_object('akun', v_akun, 'debit', p_total), jsonb_build_object('akun', '2-100', 'kredit', p_total));
  end if;
  v_jurnal := app.posting_jurnal(p_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Tagihan ' || btrim(p_pemasok) || coalesce(' ' || p_nomor, ''), 200),
    'sumber', 'pembelian', 'sumber_id', p_kunci::text, 'kunci_idempoten', 'tagihan-beli:' || p_kunci), v_baris, auth.uid());
  insert into public.tagihan_beli (perusahaan_id, pemasok, nomor_pemasok, tanggal, jatuh_tempo, total, dokumen_id, usulan_id, selisih, akun_beban, jurnal_id, kunci_klien, dibuat_oleh)
  values (p_pid, btrim(p_pemasok), nullif(left(btrim(coalesce(p_nomor, '')), 60), ''), v_tgl, greatest(coalesce(p_jatuh_tempo, v_tgl), v_tgl), p_total, p_dokumen, p_usulan,
          v_selisih, v_akun, (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid())
  returning * into t;
  return jsonb_build_object('id', t.id, 'selisih', v_selisih, 'sudah', false);
end $$;

create or replace function public.buat_tagihan_beli(p_pemasok text, p_nomor text, p_tanggal date, p_jatuh_tempo date, p_total bigint, p_dokumen uuid, p_akun text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_beli(); d public.dokumen_beli;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if p_dokumen is not null then select * into d from public.dokumen_beli where id = p_dokumen and perusahaan_id = v_pid; end if;
  return app.buat_tagihan_beli(v_pid, coalesce(nullif(btrim(coalesce(p_pemasok, '')), ''), d.pemasok), p_nomor, p_tanggal, p_jatuh_tempo,
    coalesce(p_total, d.total), p_dokumen, null, p_akun, p_kunci);
end $$;

create or replace function public.bayar_tagihan_beli(p_tagihan uuid, p_jumlah bigint, p_cara text, p_tanggal date, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_beli(); t public.tagihan_beli; b public.bayar_beli; v_sisa bigint; v_tgl date; v_jurnal jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into b from public.bayar_beli where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', b.id, 'sudah', true); end if;
  select * into t from public.tagihan_beli where id = p_tagihan and perusahaan_id = v_pid for update;
  if not found then raise exception 'Tagihan tidak ditemukan' using errcode = 'P0002'; end if;
  if t.status <> 'terbuka' then raise exception 'Tagihan ini sudah lunas atau dibatalkan' using errcode = '22023'; end if;
  v_sisa := t.total - t.terbayar - t.dikurangi;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > v_sisa then raise exception 'Jumlah bayar 1 sampai sisa tagihan (Rp%)', v_sisa using errcode = '22023'; end if;
  if p_cara not in ('tunai', 'transfer') then raise exception 'Pilih tunai atau transfer' using errcode = '22023'; end if;
  v_tgl := coalesce(p_tanggal, app.hari_ini(v_pid));
  if v_tgl > app.hari_ini(v_pid) then raise exception 'Tanggal bayar tidak boleh di masa depan' using errcode = '22023'; end if;
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Bayar ' || t.pemasok || coalesce(' ' || t.nomor_pemasok, ''), 200),
    'sumber', 'pembelian', 'sumber_id', t.id::text, 'kunci_idempoten', 'bayar-beli:' || p_kunci),
    jsonb_build_array(jsonb_build_object('akun', '2-100', 'debit', p_jumlah), jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'kredit', p_jumlah)), auth.uid());
  insert into public.bayar_beli (perusahaan_id, tagihan_id, jumlah, cara, tanggal, jurnal_id, kunci_klien, dibuat_oleh)
  values (v_pid, t.id, p_jumlah, p_cara, v_tgl, (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid()) returning * into b;
  update public.tagihan_beli set terbayar = terbayar + p_jumlah, status = case when terbayar + p_jumlah + dikurangi >= total then 'lunas' else status end where id = t.id;
  return jsonb_build_object('id', b.id, 'sisa', v_sisa - p_jumlah, 'sudah', false);
end $$;

-- Retur ke pemasok: barang keluar stok senilai rata-rata, hutang berkurang sebesar harga beli.
create or replace function public.retur_beli(p_tagihan uuid, p_produk uuid, p_jumlah numeric, p_harga bigint, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_beli(); t public.tagihan_beli; rb public.retur_beli; v_nilai bigint; g jsonb; v_stok bigint; r jsonb; v_baris jsonb; v_jurnal jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into rb from public.retur_beli where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', rb.id, 'nomor', rb.nomor, 'sudah', true); end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan retur' using errcode = '22023'; end if;
  select * into t from public.tagihan_beli where id = p_tagihan and perusahaan_id = v_pid for update;
  if not found then raise exception 'Tagihan tidak ditemukan' using errcode = 'P0002'; end if;
  if t.status <> 'terbuka' then raise exception 'Retur hanya untuk tagihan yang belum lunas' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 or p_harga is null or p_harga <= 0 then raise exception 'Isi jumlah dan harga retur' using errcode = '22023'; end if;
  v_nilai := round(p_jumlah * p_harga)::bigint;
  if v_nilai > t.total - t.terbayar - t.dikurangi then raise exception 'Nilai retur melebihi sisa tagihan' using errcode = '22023'; end if;
  g := app.gerak_stok(v_pid, p_produk, app.gudang_utama(v_pid), -p_jumlah, null, 'keluar', app.hari_ini(v_pid), 'Retur ke ' || t.pemasok, 'retur_beli', t.id::text, 'retur-beli:' || p_kunci);
  v_stok := -(g ->> 'nilai')::bigint;
  perform app.pasang_akun_stok(v_pid);
  v_baris := jsonb_build_array(jsonb_build_object('akun', '2-100', 'debit', v_nilai));
  if v_stok > 0 then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-300', 'kredit', v_stok)); end if;
  if v_nilai > v_stok then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '5-200', 'kredit', v_nilai - v_stok));
  elsif v_nilai < v_stok then v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '5-200', 'debit', v_stok - v_nilai)); end if;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'ND', 'Nota debit', '{no:3}/ND/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, 'ND', 'retur beli ' || p_kunci, auth.uid());
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Nota debit ' || (r ->> 'nomor') || ' ke ' || t.pemasok, 200), 'sumber', 'pembelian',
    'sumber_id', t.id::text, 'kunci_idempoten', 'retur-beli:' || p_kunci), v_baris, auth.uid());
  insert into public.retur_beli (perusahaan_id, tagihan_id, nomor, produk_id, jumlah, nilai, nilai_stok, alasan, jurnal_id, kunci_klien, dibuat_oleh)
  values (v_pid, t.id, r ->> 'nomor', p_produk, p_jumlah, v_nilai, v_stok, left(btrim(p_alasan), 300), (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid()) returning * into rb;
  update public.tagihan_beli set dikurangi = dikurangi + v_nilai, status = case when terbayar + dikurangi + v_nilai >= total then 'lunas' else status end where id = t.id;
  return jsonb_build_object('id', rb.id, 'nomor', rb.nomor, 'nilai', v_nilai, 'nilai_stok', v_stok, 'sudah', false);
end $$;

-- Saldo per pemasok: tagihan terbuka, sisa hutang, jatuh tempo terdekat.
create or replace function public.saldo_pemasok() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'pemasok'), '[]') from (
    select jsonb_build_object('pemasok', t.pemasok, 'terbuka', count(*) filter (where t.status = 'terbuka'),
             'sisa', coalesce(sum(t.total - t.terbayar - t.dikurangi) filter (where t.status = 'terbuka'), 0),
             'jatuh_tempo', min(t.jatuh_tempo) filter (where t.status = 'terbuka')) as x
      from public.tagihan_beli t where t.perusahaan_id = app.wajib_beli() group by t.pemasok
  ) s
$$;

-- Usulan nota/tagihan pemasok dari Lempar: sebut PO terbuka yang cocok (nama pemasok mirip) dan selisihnya.
create or replace function app.cocokkan_po_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pemasok text := coalesce(new.payload #>> '{bidang,pemasok}', new.payload #>> '{bidang,penjual}'); v_total numeric := (new.payload #>> '{bidang,total}')::numeric;
  po record;
begin
  if v_pemasok is null or length(btrim(v_pemasok)) < 3 then return new; end if;
  select d.id, d.nomor, d.total into po from public.dokumen_beli d
   where d.perusahaan_id = new.perusahaan_id and d.jenis = 'pesanan_beli' and d.status = 'terbit'
     and extensions.similarity(lower(d.pemasok), lower(v_pemasok)) >= 0.6
   order by extensions.similarity(lower(d.pemasok), lower(v_pemasok)) desc, d.dibuat_at desc limit 1;
  if po.id is null then return new; end if;
  new.payload := new.payload || jsonb_build_object('po', jsonb_build_object('id', po.id, 'nomor', po.nomor, 'total', po.total));
  new.penjelasan := left(coalesce(new.penjelasan, '') || ' Cocok dengan ' || po.nomor ||
    case when v_total is null then '.' when v_total = po.total then ', jumlah sama.' else ', selisih ' || app.rupiah((v_total - po.total)::bigint) || '.' end, 1000);
  return new;
exception when others then
  return new;
end $$;
create trigger cocokkan_po_usulan before insert on public.usulan for each row
  when (new.aksi in ('uang.keluar', 'uang.tagihan')) execute function app.cocokkan_po_usulan();

-- Usulan nota/tagihan pemasok yang disetujui menjadi tagihan_beli (hutang), jatuh tempo dari dokumen atau tanggal nota.
create or replace function app.tagihan_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb := new.payload -> 'bidang'; v_total bigint; v_tgl date; v_jt date;
begin
  begin v_total := round((b ->> 'total')::numeric)::bigint; exception when others then v_total := null; end;
  if v_total is null or v_total <= 0 then return null; end if;
  v_tgl := coalesce(app.tanggal_teks(b ->> 'tanggal'), app.hari_ini(new.perusahaan_id));
  v_jt := coalesce(app.tanggal_teks(b ->> 'jatuh_tempo'), v_tgl);
  perform app.buat_tagihan_beli(new.perusahaan_id, left(coalesce(nullif(btrim(coalesce(b ->> 'pemasok', b ->> 'penjual', '')), ''), 'Pemasok'), 100),
    b ->> 'nomor', v_tgl, v_jt, v_total, null, new.id, '6-900', new.id);
  return null;
end $$;
create trigger tagihan_dari_usulan after update of status on public.usulan for each row
  when (new.aksi in ('uang.keluar', 'uang.tagihan') and new.status = 'diterima' and old.status is distinct from 'diterima')
  execute function app.tagihan_dari_usulan();

revoke all on function app.wajib_beli(), app.buat_tagihan_beli(uuid, text, text, date, date, bigint, uuid, uuid, text, uuid), app.cocokkan_po_usulan(),
  app.tagihan_dari_usulan() from public, anon, authenticated;
revoke all on function public.buat_dokumen_beli(text, uuid, text, jsonb, text, uuid), public.buat_tagihan_beli(text, text, date, date, bigint, uuid, text, uuid),
  public.bayar_tagihan_beli(uuid, bigint, text, date, uuid), public.retur_beli(uuid, uuid, numeric, bigint, text, uuid), public.saldo_pemasok() from public, anon;
grant execute on function public.buat_dokumen_beli(text, uuid, text, jsonb, text, uuid), public.buat_tagihan_beli(text, text, date, date, bigint, uuid, text, uuid),
  public.bayar_tagihan_beli(uuid, bigint, text, date, uuid), public.retur_beli(uuid, uuid, numeric, bigint, text, uuid), public.saldo_pemasok() to authenticated;
