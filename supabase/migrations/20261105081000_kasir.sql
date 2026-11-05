-- M-19 kasir PWA (menutup LA-03, JU-31; tes supabase/tests/kasir.test.sql):
--   - pos_shift: kasir membuka shift dengan kas awal, menutup dengan kas hitung; selisih dibukukan (kurang: D 6-940 / K 1-100,
--     lebih: D 1-100 / K 4-900);
--   - pos_sale: satu penjualan; kunci klien dari perangkat (antrean luring) sehingga sinkron ulang tidak menggandakan; harga dari
--     data produk saat sinkron (total perangkat disimpan untuk audit); stok keluar gudang utama lewat app.gerak_stok (rata-rata
--     tertimbang, menolak stok kurang kecuali produk boleh minus); jurnal: D kas 1-100 (tunai) atau bank 1-110 (QRIS/transfer) / K 4-100,
--     dan HPP D 5-100 / K 1-300; waktu jual dari perangkat (dibatasi 7 hari ke belakang, tidak di masa depan);
--   - struk publik /struk/<kode> (kode acak) untuk dibagikan lewat WhatsApp; laporan harian per cara bayar dan per kasir.
-- Kasir = anggota aktif usaha (termasuk staf) yang membuka shift.

create table public.pos_shift (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  user_id uuid not null,
  orang_id uuid references public.orang(id),
  dibuka_at timestamptz not null default now(),
  kas_awal bigint not null check (kas_awal between 0 and 1000000000),
  ditutup_at timestamptz,
  kas_hitung bigint check (kas_hitung is null or kas_hitung between 0 and 10000000000),
  kas_harus bigint,
  selisih bigint,
  unique (perusahaan_id, id),
  check ((ditutup_at is null) = (kas_hitung is null))
);
create unique index pos_shift_satu_terbuka on public.pos_shift (perusahaan_id, user_id) where ditutup_at is null;

create table public.pos_sale (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  shift_id uuid not null,
  kunci_klien uuid not null,
  kode text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex')),
  waktu timestamptz not null,
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 100),
  total bigint not null check (total > 0),
  total_perangkat bigint,
  bayar text not null check (bayar in ('tunai', 'qris', 'transfer')),
  diterima bigint not null default 0 check (diterima >= 0),
  kembalian bigint not null default 0 check (kembalian >= 0),
  hpp bigint not null default 0,
  jurnal_id uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  foreign key (perusahaan_id, shift_id) references public.pos_shift (perusahaan_id, id)
);
create index on public.pos_sale (perusahaan_id, waktu);
create index on public.pos_sale (shift_id);

alter table public.pos_shift enable row level security;
alter table public.pos_sale enable row level security;
-- Pengelola melihat semua; kasir melihat shift dan penjualannya sendiri.
create policy pos_shift_baca on public.pos_shift for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan') or user_id = (select auth.uid())));
create policy pos_sale_baca on public.pos_sale for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan')
         or exists (select 1 from public.pos_shift s where s.id = pos_sale.shift_id and s.user_id = (select auth.uid()))));
grant select on public.pos_shift, public.pos_sale to authenticated;

create or replace function app.wajib_kasir() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or auth.uid() is null or not exists (select 1 from public.anggota a where a.perusahaan_id = v_pid and a.user_id = auth.uid() and a.aktif) then
    raise exception 'Masuk sebagai anggota usaha ini dulu' using errcode = '42501';
  end if;
  return v_pid;
end $$;

create or replace function public.pos_open_shift(p_kas_awal bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); v uuid;
begin
  select id into v from public.pos_shift where perusahaan_id = v_pid and user_id = auth.uid() and ditutup_at is null;
  if found then return v; end if;
  if p_kas_awal is null or p_kas_awal < 0 or p_kas_awal > 1000000000 then raise exception 'Isi kas awal laci dalam rupiah' using errcode = '22023'; end if;
  insert into public.pos_shift (perusahaan_id, user_id, orang_id, kas_awal) values (v_pid, auth.uid(), app.orang_saya(), p_kas_awal) returning id into v;
  return v;
end $$;

-- Satu penjualan (dipanggil saat kasir menekan Bayar, atau saat antrean luring disinkronkan). Idempoten per kunci klien.
create or replace function public.pos_record_sale(p_shift uuid, p_kunci uuid, p_waktu timestamptz, p_baris jsonb, p_bayar text, p_diterima bigint, p_total_perangkat bigint default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); sh public.pos_shift; ps public.pos_sale; e jsonb; pr public.produk; v_baris jsonb := '[]'; v_total numeric := 0;
  v_jml numeric; v_hpp bigint := 0; r jsonb; v_gudang uuid; v_waktu timestamptz; v_tgl date; i int := 0; v_kas text; v_j jsonb; v_kode text;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into ps from public.pos_sale where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('kode', ps.kode, 'total', ps.total, 'kembalian', ps.kembalian, 'baru', false); end if;
  select * into sh from public.pos_shift where id = p_shift and perusahaan_id = v_pid and user_id = auth.uid();
  if not found then raise exception 'Shift kasir tidak ditemukan. Buka shift dulu.' using errcode = 'P0002'; end if;
  if p_bayar not in ('tunai', 'qris', 'transfer') then raise exception 'Cara bayar: tunai, QRIS, atau transfer' using errcode = '22023'; end if;
  v_waktu := least(coalesce(p_waktu, now()), now());
  if v_waktu < now() - interval '7 days' then raise exception 'Penjualan luring lebih dari 7 hari tidak bisa disinkronkan. Catat lewat invoice.' using errcode = '22023'; end if;
  if v_waktu < sh.dibuka_at - interval '1 minute' then v_waktu := sh.dibuka_at; end if;
  v_tgl := (v_waktu at time zone coalesce((select zona_waktu from public.perusahaan where id = v_pid), 'Asia/Jakarta'))::date;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 100 then raise exception 'Isi 1 sampai 100 barang' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    begin
      v_jml := (e ->> 'jumlah')::numeric;
      select * into pr from public.produk where id = (e ->> 'produk')::uuid and perusahaan_id = v_pid;
    exception when others then raise exception 'Barang atau jumlah tidak terbaca' using errcode = '22023';
    end;
    if pr.id is null or not pr.aktif then raise exception 'Produk tidak ditemukan atau tidak aktif' using errcode = 'P0002'; end if;
    if v_jml is null or v_jml <= 0 or v_jml > 100000 then raise exception 'Jumlah % harus lebih dari 0', pr.nama using errcode = '22023'; end if;
    v_total := v_total + round(v_jml * pr.harga_jual);
    v_baris := v_baris || jsonb_build_object('produk', pr.id, 'nama', pr.nama, 'jumlah', v_jml, 'harga', pr.harga_jual, 'satuan', pr.satuan);
  end loop;
  if v_total <= 0 then raise exception 'Total masih Rp0' using errcode = '22023'; end if;
  if p_bayar = 'tunai' and coalesce(p_diterima, 0) < v_total then raise exception 'Uang diterima kurang dari total %', app.rupiah(v_total::bigint) using errcode = '22023'; end if;
  insert into public.pos_sale (perusahaan_id, shift_id, kunci_klien, waktu, baris, total, total_perangkat, bayar, diterima, kembalian)
  values (v_pid, sh.id, p_kunci, v_waktu, v_baris, v_total::bigint, p_total_perangkat, p_bayar,
          case when p_bayar = 'tunai' then p_diterima else v_total::bigint end, case when p_bayar = 'tunai' then p_diterima - v_total::bigint else 0 end)
  returning * into ps;
  v_gudang := app.gudang_utama(v_pid);
  for e in select * from jsonb_array_elements(v_baris) loop
    i := i + 1;
    select * into pr from public.produk where id = (e ->> 'produk')::uuid;
    continue when pr.jenis = 'jasa';
    if pr.jenis = 'barang' then
      r := app.gerak_stok(v_pid, pr.id, v_gudang, -(e ->> 'jumlah')::numeric, null, 'keluar', v_tgl, 'Kasir ' || ps.kode, 'kasir', ps.id::text, 'kasir:' || ps.id || ':' || i);
      v_hpp := v_hpp - (r ->> 'nilai')::bigint;
    else
      for r in select jsonb_build_object('k', c.komponen_id, 'j', c.jumlah) from public.produk_komponen c where c.produk_id = pr.id loop
        v_j := app.gerak_stok(v_pid, (r ->> 'k')::uuid, v_gudang, -((e ->> 'jumlah')::numeric * (r ->> 'j')::numeric), null, 'keluar', v_tgl, 'Kasir ' || ps.kode,
               'kasir', ps.id::text, 'kasir:' || ps.id || ':' || i || ':' || (r ->> 'k'));
        v_hpp := v_hpp - (v_j ->> 'nilai')::bigint;
      end loop;
    end if;
  end loop;
  v_kas := case when p_bayar = 'tunai' then '1-100' else '1-110' end;
  v_j := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Penjualan kasir ' || ps.kode, 200), 'sumber', 'kasir', 'sumber_id', ps.id::text,
           'kunci_idempoten', 'kasir:' || ps.id),
         jsonb_build_array(jsonb_build_object('akun', v_kas, 'debit', ps.total), jsonb_build_object('akun', '4-100', 'kredit', ps.total)), auth.uid());
  if v_hpp > 0 then
    perform app.pasang_akun_stok(v_pid);
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('HPP kasir ' || ps.kode, 200), 'sumber', 'stok', 'sumber_id', ps.id::text,
              'kunci_idempoten', 'hpp_kasir:' || ps.id),
            jsonb_build_array(jsonb_build_object('akun', '5-100', 'debit', v_hpp), jsonb_build_object('akun', '1-300', 'kredit', v_hpp)), auth.uid());
  end if;
  update public.pos_sale set hpp = v_hpp, jurnal_id = (v_j ->> 'id')::uuid where id = ps.id;
  return jsonb_build_object('kode', ps.kode, 'total', ps.total, 'kembalian', ps.kembalian, 'baru', true);
end $$;

-- Tutup shift: kas harus = kas awal + penjualan tunai shift; selisih dibukukan.
create or replace function public.pos_close_shift(p_shift uuid, p_kas_hitung bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); sh public.pos_shift; v_harus bigint; v_sel bigint; v_tgl date;
begin
  select * into sh from public.pos_shift where id = p_shift and perusahaan_id = v_pid and user_id = auth.uid() for update;
  if not found then raise exception 'Shift tidak ditemukan' using errcode = 'P0002'; end if;
  if sh.ditutup_at is not null then return jsonb_build_object('kas_harus', sh.kas_harus, 'selisih', sh.selisih, 'sudah', true); end if;
  if p_kas_hitung is null or p_kas_hitung < 0 then raise exception 'Isi hasil hitung kas laci' using errcode = '22023'; end if;
  v_harus := sh.kas_awal + coalesce((select sum(total) from public.pos_sale where shift_id = sh.id and bayar = 'tunai'), 0);
  v_sel := p_kas_hitung - v_harus;
  update public.pos_shift set ditutup_at = now(), kas_hitung = p_kas_hitung, kas_harus = v_harus, selisih = v_sel where id = sh.id;
  v_tgl := app.hari_ini(v_pid);
  if v_sel <> 0 then
    perform app.akun_pastikan(v_pid, '6-940', 'Selisih kas kasir', 'beban', 'debit');
    perform app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', 'Selisih kas tutup shift kasir', 'sumber', 'kasir', 'sumber_id', sh.id::text,
              'kunci_idempoten', 'selisih_kasir:' || sh.id),
            case when v_sel < 0 then jsonb_build_array(jsonb_build_object('akun', '6-940', 'debit', -v_sel), jsonb_build_object('akun', '1-100', 'kredit', -v_sel))
                 else jsonb_build_array(jsonb_build_object('akun', '1-100', 'debit', v_sel), jsonb_build_object('akun', '4-900', 'kredit', v_sel)) end, auth.uid());
  end if;
  return jsonb_build_object('kas_harus', v_harus, 'selisih', v_sel, 'sudah', false);
end $$;

-- Daftar produk aktif untuk kasir (disimpan perangkat untuk luring): nama, harga, barcode, stok gudang utama.
create or replace function public.pos_products() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); v_g uuid := app.gudang_utama(v_pid);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kode', p.kode, 'nama', p.nama, 'harga', p.harga_jual, 'satuan', p.satuan, 'barcode', p.barcode,
           'jenis', p.jenis, 'stok', (select s.jumlah from public.stok s where s.produk_id = p.id and s.gudang_id = v_g)) order by p.nama)
    from public.produk p where p.perusahaan_id = v_pid and p.aktif and p.harga_jual > 0), '[]');
end $$;

create or replace function public.pos_daily(p_tanggal date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); v_zona text := coalesce((select zona_waktu from public.perusahaan where id = v_pid), 'Asia/Jakarta');
  v_semua boolean := coalesce((select app.peran_aktif()), '') in ('pemilik', 'admin', 'akuntan');
begin
  return (with s as (
    select ps.*, sh.user_id, o.nama as kasir from public.pos_sale ps join public.pos_shift sh on sh.id = ps.shift_id left join public.orang o on o.id = sh.orang_id
     where ps.perusahaan_id = v_pid and (ps.waktu at time zone v_zona)::date = p_tanggal and (v_semua or sh.user_id = auth.uid()))
  select jsonb_build_object('tanggal', p_tanggal, 'transaksi', count(*), 'total', coalesce(sum(total), 0), 'hpp', coalesce(sum(hpp), 0),
    'per_bayar', jsonb_build_object('tunai', coalesce(sum(total) filter (where bayar = 'tunai'), 0), 'qris', coalesce(sum(total) filter (where bayar = 'qris'), 0),
                                    'transfer', coalesce(sum(total) filter (where bayar = 'transfer'), 0)),
    'per_kasir', coalesce((select jsonb_agg(jsonb_build_object('kasir', coalesce(k.kasir, '-'), 'transaksi', k.n, 'total', k.t)) from
                    (select kasir, count(*) n, sum(total) t from s group by kasir) k), '[]')) from s);
end $$;

-- Struk publik dari kode acak: tanpa data kasir atau pembeli.
create or replace function public.pos_receipt(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'kode', s.kode, 'waktu', s.waktu, 'zona', p.zona_waktu, 'baris', s.baris, 'total', s.total, 'bayar', s.bayar,
           'diterima', s.diterima, 'kembalian', s.kembalian)
    from public.pos_sale s join public.perusahaan p on p.id = s.perusahaan_id where s.kode = upper(btrim(coalesce(p_kode, '')))
$$;

revoke all on function app.wajib_kasir() from public, anon, authenticated;
revoke all on function public.pos_open_shift(bigint), public.pos_record_sale(uuid, uuid, timestamptz, jsonb, text, bigint, bigint), public.pos_close_shift(uuid, bigint),
  public.pos_products(), public.pos_daily(date), public.pos_receipt(text) from public;
grant execute on function public.pos_open_shift(bigint), public.pos_record_sale(uuid, uuid, timestamptz, jsonb, text, bigint, bigint), public.pos_close_shift(uuid, bigint),
  public.pos_products(), public.pos_daily(date) to authenticated;
grant execute on function public.pos_receipt(text) to anon, authenticated;
