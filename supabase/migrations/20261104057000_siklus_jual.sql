-- M-03 Siklus penjualan (docs/research/mekari/rencana.md, menutup JU-03, JU-04, JU-08, JU-23; tes supabase/tests/siklus_jual.test.sql).
--
-- Alur dokumen: penawaran (pro forma saat dicetak) > pesanan > surat jalan > invoice. Invoice tetap dibuat public.buat_invoice.
--
-- Jurnal per tahap:
--   - penawaran dan surat jalan: tanpa jurnal; surat jalan hanya dokumen kirim, stok keluar saat invoice terbit seperti sebelumnya;
--   - uang muka pesanan: kas/bank / 2-400 uang muka pelanggan;
--   - invoice dari pesanan: memakai uang muka 2-400 / 1-200 sebesar sisa uang muka;
--   - retur (nota kredit): 4-200 retur penjualan / 1-200 (invoice belum lunas) atau 2-410 utang ke pelanggan (sudah lunas);
--     stok kembali senilai saat keluar, 1-300 / 5-100;
--   - lunas dipotong PPh oleh pembeli: bank (sisa - potongan) + 1-430 PPh dipotong pelanggan / 1-200.
--     Besar potongan diisi pengguna dari bukti potong; Nadi tidak memasang tarif.
-- Invoice termin (progress): satu baris "Termin n% dari <nomor pesanan>" tanpa produk, jadi stok tidak bergerak.
-- Invoice 100% dari pesanan menyalin baris berproduk, jadi stok keluar lewat trigger stok_invoice.

create table public.dokumen_jual (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('penawaran', 'pesanan', 'surat_jalan')),
  nomor text not null,
  nomor_terbit_id uuid not null references public.nomor_terbit(id),
  induk_id uuid,
  pelanggan text not null check (length(btrim(pelanggan)) between 1 and 100),
  pelanggan_hp text check (pelanggan_hp is null or pelanggan_hp ~ '^62[0-9]{8,13}$'),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 30),
  total bigint not null check (total > 0),
  tanggal date not null,
  berlaku_sampai date,
  uang_muka bigint not null default 0 check (uang_muka >= 0),
  uang_muka_terpakai bigint not null default 0 check (uang_muka_terpakai >= 0),
  persen_ditagih numeric(6, 2) not null default 0 check (persen_ditagih between 0 and 100),
  status text not null default 'terbit' check (status in ('terbit', 'diterima', 'selesai', 'batal')),
  catatan text check (catatan is null or length(catatan) <= 300),
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, id),
  foreign key (perusahaan_id, induk_id) references public.dokumen_jual (perusahaan_id, id),
  check (uang_muka_terpakai <= uang_muka)
);
create index on public.dokumen_jual (perusahaan_id, dibuat_at desc);
create index on public.dokumen_jual (induk_id);

create table public.retur_jual (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  invoice_id uuid not null,
  nomor text not null,
  baris jsonb not null,
  nilai bigint not null check (nilai > 0),
  hpp_balik bigint not null default 0,
  jurnal_id uuid,
  alasan text not null check (length(btrim(alasan)) between 3 and 300),
  tanggal date not null,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  foreign key (perusahaan_id, invoice_id) references public.invoice (perusahaan_id, id)
);
create index on public.retur_jual (invoice_id);

alter table public.invoice
  add column dokumen_id uuid,
  add column potong_piutang bigint not null default 0 check (potong_piutang >= 0),
  add column pph_dipotong bigint not null default 0 check (pph_dipotong >= 0),
  add column pph_jenis text check (pph_jenis is null or pph_jenis in ('pph23', 'pph4_2', 'pph22', 'lain')),
  add constraint invoice_dokumen_fk foreign key (perusahaan_id, dokumen_id) references public.dokumen_jual (perusahaan_id, id);
create index on public.invoice (dokumen_id);

alter table public.dokumen_jual enable row level security;
alter table public.retur_jual enable row level security;
create policy dokumen_jual_baca on public.dokumen_jual for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy retur_jual_baca on public.retur_jual for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.dokumen_jual, public.retur_jual to authenticated;
create trigger audit_dokumen_jual after insert or update or delete on public.dokumen_jual for each row execute function app.catat_audit();

create or replace function app.akun_pastikan(p_pid uuid, p_kode text, p_nama text, p_golongan text, p_normal text) returns void
language sql security definer set search_path = '' as $$
  insert into public.akun (perusahaan_id, kode, nama, golongan, saldo_normal, bawaan)
  values (p_pid, p_kode, p_nama, p_golongan, p_normal, true) on conflict (perusahaan_id, kode) do nothing
$$;

-- Baris penjualan dirapikan dengan aturan yang sama dengan buat_invoice (uraian, jumlah, harga rupiah bulat, produk opsional).
create or replace function app.rapikan_baris_jual(p_pid uuid, p_baris jsonb, out baris jsonb, out total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare e jsonb; v_jml numeric; v_hrg numeric; v_uraian text; v_produk uuid; v_el jsonb; v_total numeric := 0;
begin
  baris := '[]';
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) not between 1 and 30 then
    raise exception 'Isi 1 sampai 30 baris barang atau jasa.' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    v_uraian := btrim(coalesce(e ->> 'uraian', ''));
    begin
      v_jml := (e ->> 'jumlah')::numeric; v_hrg := (e ->> 'harga')::numeric; v_produk := nullif(e ->> 'produk', '')::uuid;
    exception when others then
      raise exception 'Jumlah dan harga harus angka.' using errcode = '22023';
    end;
    if length(v_uraian) not between 1 and 120 or v_jml is null or v_jml <= 0 or v_jml > 100000 or v_hrg is null or v_hrg < 0
       or v_hrg <> trunc(v_hrg) or v_hrg > 1000000000000 then
      raise exception 'Setiap baris butuh uraian, jumlah lebih dari 0, dan harga rupiah bulat.' using errcode = '22023';
    end if;
    v_el := jsonb_build_object('uraian', v_uraian, 'jumlah', v_jml, 'harga', v_hrg::bigint);
    if v_produk is not null then
      if not exists (select 1 from public.produk p where p.id = v_produk and p.perusahaan_id = p_pid and p.aktif) then
        raise exception 'Produk di baris "%" tidak ditemukan di usaha ini.', v_uraian using errcode = '22023';
      end if;
      v_el := v_el || jsonb_build_object('produk', v_produk) || case when e ? 'satuan' then jsonb_build_object('satuan', e ->> 'satuan') else '{}' end;
    end if;
    v_total := v_total + round(v_jml * v_hrg);
    baris := baris || jsonb_build_array(v_el);
  end loop;
  if v_total <= 0 then raise exception 'Total masih Rp0.' using errcode = '22023'; end if;
  total := v_total::bigint;
end $$;

create or replace function public.buat_dokumen_jual(p_jenis text, p_induk uuid, p_pelanggan text, p_hp text, p_baris jsonb, p_berlaku date,
  p_catatan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); d public.dokumen_jual; ind public.dokumen_jual; v_kode text; v_tpl text; r jsonb; rb record;
  v_pelanggan text; v_hp text; v_baris jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into d from public.dokumen_jual where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', d.id, 'nomor', d.nomor, 'total', d.total, 'sudah', true); end if;
  if p_jenis not in ('penawaran', 'pesanan', 'surat_jalan') then raise exception 'Jenis dokumen tidak dikenal' using errcode = '22023'; end if;
  if p_induk is not null then
    select * into ind from public.dokumen_jual where id = p_induk and perusahaan_id = v_pid for update;
    if not found then raise exception 'Dokumen asal tidak ditemukan' using errcode = 'P0002'; end if;
    if ind.status = 'batal' then raise exception 'Dokumen asal sudah dibatalkan' using errcode = '22023'; end if;
    if not ((p_jenis = 'pesanan' and ind.jenis = 'penawaran') or (p_jenis = 'surat_jalan' and ind.jenis = 'pesanan')) then
      raise exception 'Urutan dokumen: penawaran, lalu pesanan, lalu surat jalan' using errcode = '22023';
    end if;
  elsif p_jenis = 'surat_jalan' then
    raise exception 'Surat jalan dibuat dari pesanan' using errcode = '22023';
  end if;
  v_pelanggan := coalesce(nullif(btrim(coalesce(p_pelanggan, '')), ''), ind.pelanggan);
  v_hp := coalesce(nullif(btrim(coalesce(p_hp, '')), ''), ind.pelanggan_hp);
  v_baris := coalesce(p_baris, ind.baris);
  if v_pelanggan is null or length(v_pelanggan) > 100 then raise exception 'Tulis nama pelanggan (paling panjang 100 huruf).' using errcode = '22023'; end if;
  if v_hp is not null and v_hp !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp pelanggan belum benar.' using errcode = '22023'; end if;
  select * into rb from app.rapikan_baris_jual(v_pid, v_baris);
  v_kode := case p_jenis when 'penawaran' then 'PNW' when 'pesanan' then 'SO' else 'SJ' end;
  v_tpl := '{no:3}/' || v_kode || '/{bulan_romawi}/{tahun}';
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat)
  values (v_pid, v_kode, case p_jenis when 'penawaran' then 'Penawaran' when 'pesanan' then 'Pesanan' else 'Surat jalan' end, v_tpl)
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, v_kode, p_jenis || ' ' || p_kunci, auth.uid());
  insert into public.dokumen_jual (perusahaan_id, jenis, nomor, nomor_terbit_id, induk_id, pelanggan, pelanggan_hp, baris, total, tanggal,
                                   berlaku_sampai, catatan, kunci_klien, dibuat_oleh)
  values (v_pid, p_jenis, r ->> 'nomor', (r ->> 'id')::uuid, p_induk, v_pelanggan, v_hp, rb.baris, rb.total, app.hari_ini(v_pid),
          case when p_jenis = 'penawaran' then p_berlaku end, nullif(left(btrim(coalesce(p_catatan, '')), 300), ''), p_kunci, auth.uid())
  returning * into d;
  if p_induk is not null and ind.jenis = 'penawaran' then
    update public.dokumen_jual set status = 'diterima' where id = ind.id;
  end if;
  return jsonb_build_object('id', d.id, 'nomor', d.nomor, 'total', d.total, 'sudah', false);
end $$;

create or replace function public.terima_uang_muka(p_pesanan uuid, p_jumlah bigint, p_cara text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); d public.dokumen_jual; r jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  if exists (select 1 from public.jurnal j where j.perusahaan_id = v_pid and j.kunci_idempoten = 'uang-muka:' || p_kunci) then
    return jsonb_build_object('sudah', true);
  end if;
  select * into d from public.dokumen_jual where id = p_pesanan and perusahaan_id = v_pid for update;
  if not found or d.jenis <> 'pesanan' then raise exception 'Uang muka hanya untuk pesanan' using errcode = 'P0002'; end if;
  if d.status <> 'terbit' then raise exception 'Pesanan ini sudah selesai atau dibatalkan' using errcode = '22023'; end if;
  if p_jumlah is null or p_jumlah <= 0 or d.uang_muka + p_jumlah > d.total then
    raise exception 'Uang muka lebih dari 0 dan tidak melebihi total pesanan' using errcode = '22023';
  end if;
  if p_cara not in ('tunai', 'transfer', 'qris') then raise exception 'Pilih cara bayar: QRIS, transfer, atau tunai.' using errcode = '22023'; end if;
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.akun_pastikan(v_pid, '2-400', 'Uang muka pelanggan', 'kewajiban', 'kredit');
  r := app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Uang muka ' || d.nomor || ' ' || d.pelanggan, 200), 'sumber', 'penjualan',
         'sumber_id', d.id::text, 'kunci_idempoten', 'uang-muka:' || p_kunci),
       jsonb_build_array(jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'debit', p_jumlah),
                         jsonb_build_object('akun', '2-400', 'kredit', p_jumlah)), auth.uid());
  update public.dokumen_jual set uang_muka = uang_muka + p_jumlah where id = d.id;
  return jsonb_build_object('sudah', false, 'uang_muka', d.uang_muka + p_jumlah);
end $$;

-- Invoice dari pesanan atau surat jalan. p_persen < 100 = invoice termin satu baris tanpa produk. Uang muka pesanan dipakai lebih dulu.
create or replace function public.invoice_dari_dokumen(p_dokumen uuid, p_persen numeric, p_jatuh_tempo date, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); d public.dokumen_jual; ps public.dokumen_jual; v_persen numeric := coalesce(p_persen, 100);
  v_baris jsonb; v_nilai bigint; r jsonb; v_inv uuid; v_um bigint; inv public.invoice;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into inv from public.invoice where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', inv.id, 'nomor', inv.nomor, 'sudah', true); end if;
  select * into d from public.dokumen_jual where id = p_dokumen and perusahaan_id = v_pid;
  if not found or d.jenis = 'penawaran' then raise exception 'Invoice dibuat dari pesanan atau surat jalan' using errcode = '22023'; end if;
  if d.jenis = 'surat_jalan' then
    select * into ps from public.dokumen_jual where id = d.induk_id and perusahaan_id = v_pid for update;
  else
    select * into ps from public.dokumen_jual where id = d.id for update;
  end if;
  if ps.status in ('selesai', 'batal') then raise exception 'Pesanan ini sudah ditagih penuh atau dibatalkan' using errcode = '22023'; end if;
  if v_persen <= 0 or v_persen > 100 or ps.persen_ditagih + v_persen > 100 then
    raise exception 'Sisa yang bisa ditagih % persen', 100 - ps.persen_ditagih using errcode = '22023';
  end if;
  if v_persen = 100 and ps.persen_ditagih = 0 then
    v_baris := d.baris;
  else
    v_nilai := case when ps.persen_ditagih + v_persen = 100 then ps.total - round(ps.total * ps.persen_ditagih / 100)::bigint
                    else round(ps.total * v_persen / 100)::bigint end;
    v_baris := jsonb_build_array(jsonb_build_object('uraian', left('Termin ' || trim(to_char(v_persen, 'FM990.##')) || '% dari ' || ps.nomor, 120), 'jumlah', 1, 'harga', v_nilai));
  end if;
  r := public.buat_invoice(d.pelanggan, d.pelanggan_hp, v_baris, p_jatuh_tempo, 'Dari ' || d.nomor, p_kunci);
  v_inv := (r ->> 'id')::uuid;
  select * into inv from public.invoice where id = v_inv;
  v_um := least(ps.uang_muka - ps.uang_muka_terpakai, inv.total);
  if v_um > 0 then
    perform app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Uang muka dipakai ' || inv.nomor, 200), 'sumber', 'penjualan',
      'sumber_id', inv.id::text, 'kunci_idempoten', 'pakai-uang-muka:' || inv.id),
      jsonb_build_array(jsonb_build_object('akun', '2-400', 'debit', v_um), jsonb_build_object('akun', '1-200', 'kredit', v_um)), auth.uid());
  end if;
  update public.invoice set dokumen_id = d.id, potong_piutang = potong_piutang + v_um where id = v_inv;
  update public.dokumen_jual set uang_muka_terpakai = uang_muka_terpakai + v_um, persen_ditagih = persen_ditagih + v_persen,
         status = case when persen_ditagih + v_persen >= 100 then 'selesai' else status end
   where id = ps.id;
  if d.id <> ps.id then update public.dokumen_jual set status = 'selesai' where id = d.id; end if;
  return r || jsonb_build_object('uang_muka_dipakai', v_um, 'sisa', inv.total - v_um);
end $$;

-- tandai_lunas: sama dengan 20261101027000, tetapi yang dibayar hanya sisa piutang (total dikurangi uang muka dan retur).
create or replace function public.tandai_lunas(p_id uuid, p_cara text, p_tanggal date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.wajib_penagih();
  return public.lunas_dipotong(p_id, p_cara, p_tanggal, 0, null);
end $$;

create or replace function public.lunas_dipotong(p_id uuid, p_cara text, p_tanggal date, p_potong bigint, p_jenis text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice; v_tgl date; v_jurnal jsonb; v_sisa bigint; v_potong bigint := coalesce(p_potong, 0); v_baris jsonb;
begin
  select * into inv from public.invoice where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'lunas' then return jsonb_build_object('id', inv.id, 'sudah', true); end if;
  if inv.status = 'batal' then raise exception 'Invoice ini sudah dibatalkan.' using errcode = '22023'; end if;
  if p_cara is null or p_cara not in ('qris', 'transfer', 'tunai') then
    raise exception 'Pilih cara bayar: QRIS, transfer, atau tunai.' using errcode = '22023';
  end if;
  v_tgl := coalesce(p_tanggal, app.hari_ini(v_pid));
  if v_tgl < inv.tanggal or v_tgl > app.hari_ini(v_pid) then
    raise exception 'Tanggal bayar antara tanggal invoice dan hari ini.' using errcode = '22023';
  end if;
  v_sisa := inv.total - inv.potong_piutang;
  if v_potong < 0 or v_potong > v_sisa then raise exception 'Potongan PPh tidak boleh melebihi sisa tagihan' using errcode = '22023'; end if;
  if v_potong > 0 and (p_jenis is null or p_jenis not in ('pph23', 'pph4_2', 'pph22', 'lain')) then
    raise exception 'Pilih jenis PPh yang dipotong pembeli' using errcode = '22023';
  end if;
  if v_sisa > 0 then
    v_baris := jsonb_build_array(jsonb_build_object('akun', '1-200', 'kredit', v_sisa));
    if v_sisa - v_potong > 0 then
      v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'debit', v_sisa - v_potong));
    end if;
    if v_potong > 0 then
      perform app.akun_pastikan(v_pid, '1-430', 'PPh dipotong pelanggan (kredit pajak)', 'aset', 'debit');
      v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-430', 'debit', v_potong));
    end if;
    v_jurnal := app.posting_jurnal(v_pid,
      jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Pelunasan ' || inv.nomor || ' ' || inv.pelanggan, 200), 'sumber', 'invoice',
                         'sumber_id', inv.id::text, 'kunci_idempoten', 'invoice-lunas:' || inv.id), v_baris, auth.uid());
  end if;
  update public.invoice set status = 'lunas', lunas_tanggal = v_tgl, lunas_cara = p_cara, lunas_oleh = auth.uid(),
         jurnal_lunas = (v_jurnal ->> 'id')::uuid, pph_dipotong = v_potong, pph_jenis = case when v_potong > 0 then p_jenis end where id = inv.id;
  update public.pengingat_invoice set status = 'tidak_perlu' where invoice_id = inv.id and status = 'jadwal';
  return jsonb_build_object('id', inv.id, 'sudah', false, 'diterima', v_sisa - v_potong);
end $$;

-- Retur / nota kredit atas invoice. p_baris [{indeks (mulai 1), jumlah}].
create or replace function public.retur_jual(p_invoice uuid, p_baris jsonb, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice; rt public.retur_jual; e jsonb; v_i int; v_jml numeric; line jsonb; v_sudah numeric;
  v_nilai bigint := 0; v_hpp bigint := 0; g public.gerak_stok; v_hpp_baris bigint; v_simpan jsonb := '[]'; r jsonb; v_jurnal jsonb; v_lawan text; v_baris jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into rt from public.retur_jual where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', rt.id, 'nomor', rt.nomor, 'nilai', rt.nilai, 'sudah', true); end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan retur' using errcode = '22023'; end if;
  select * into inv from public.invoice where id = p_invoice and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'batal' then raise exception 'Invoice batal tidak bisa diretur' using errcode = '22023'; end if;
  if jsonb_typeof(p_baris) is distinct from 'array' or jsonb_array_length(p_baris) = 0 then raise exception 'Pilih baris yang diretur' using errcode = '22023'; end if;
  for e in select * from jsonb_array_elements(p_baris) loop
    v_i := (e ->> 'indeks')::int; v_jml := (e ->> 'jumlah')::numeric;
    line := inv.baris -> (v_i - 1);
    if line is null or v_jml is null or v_jml <= 0 then raise exception 'Baris retur tidak sah' using errcode = '22023'; end if;
    select coalesce(sum((x ->> 'jumlah')::numeric), 0) into v_sudah
      from public.retur_jual rr, jsonb_array_elements(rr.baris) x where rr.invoice_id = inv.id and (x ->> 'indeks')::int = v_i;
    if v_sudah + v_jml > (line ->> 'jumlah')::numeric then
      raise exception 'Retur baris % melebihi jumlah di invoice (sisa %)', v_i, (line ->> 'jumlah')::numeric - v_sudah using errcode = '22023';
    end if;
    v_nilai := v_nilai + round(v_jml * (line ->> 'harga')::numeric)::bigint;
    v_hpp_baris := 0;
    select * into g from public.gerak_stok where perusahaan_id = v_pid and kunci = 'invoice:' || inv.id || ':' || v_i;
    if found then
      v_hpp_baris := round((-g.nilai)::numeric * v_jml / (line ->> 'jumlah')::numeric)::bigint;
      perform app.gerak_stok(v_pid, g.produk_id, g.gudang_id, (-g.jumlah) * v_jml / (line ->> 'jumlah')::numeric, v_hpp_baris, 'balik',
        app.hari_ini(v_pid), 'Retur ' || inv.nomor, 'retur', inv.id::text, 'retur:' || p_kunci || ':' || v_i);
      v_hpp := v_hpp + v_hpp_baris;
    end if;
    v_simpan := v_simpan || jsonb_build_array(jsonb_build_object('indeks', v_i, 'jumlah', v_jml, 'nilai', round(v_jml * (line ->> 'harga')::numeric)::bigint, 'hpp', v_hpp_baris));
  end loop;
  if inv.status = 'terbit' and v_nilai > inv.total - inv.potong_piutang then
    raise exception 'Nilai retur melebihi sisa tagihan' using errcode = '22023';
  end if;
  perform app.akun_pastikan(v_pid, '4-200', 'Retur penjualan', 'pendapatan', 'debit');
  v_lawan := case when inv.status = 'terbit' then '1-200' else '2-410' end;
  if v_lawan = '2-410' then perform app.akun_pastikan(v_pid, '2-410', 'Utang ke pelanggan (nota kredit)', 'kewajiban', 'kredit'); end if;
  v_baris := jsonb_build_array(jsonb_build_object('akun', '4-200', 'debit', v_nilai), jsonb_build_object('akun', v_lawan, 'kredit', v_nilai));
  if v_hpp > 0 then
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_hpp), jsonb_build_object('akun', '5-100', 'kredit', v_hpp));
  end if;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'NK', 'Nota kredit', '{no:3}/NK/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, 'NK', 'retur ' || p_kunci, auth.uid());
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('keterangan', left('Nota kredit ' || (r ->> 'nomor') || ' atas ' || inv.nomor, 200), 'sumber', 'penjualan',
    'sumber_id', inv.id::text, 'kunci_idempoten', 'retur:' || p_kunci), v_baris, auth.uid());
  insert into public.retur_jual (perusahaan_id, invoice_id, nomor, baris, nilai, hpp_balik, jurnal_id, alasan, tanggal, kunci_klien, dibuat_oleh)
  values (v_pid, inv.id, r ->> 'nomor', v_simpan, v_nilai, v_hpp, (v_jurnal ->> 'id')::uuid, left(btrim(p_alasan), 300), app.hari_ini(v_pid), p_kunci, auth.uid())
  returning * into rt;
  if inv.status = 'terbit' then
    update public.invoice set potong_piutang = potong_piutang + v_nilai where id = inv.id;
  end if;
  return jsonb_build_object('id', rt.id, 'nomor', rt.nomor, 'nilai', v_nilai, 'hpp', v_hpp, 'sudah', false);
end $$;

-- Saldo per pelanggan (kontak dari invoice): tagihan terbuka dan penjualan 12 bulan terakhir.
create or replace function public.saldo_pelanggan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'pelanggan'), '[]') from (
    select jsonb_build_object('pelanggan', i.pelanggan,
             'terbuka', count(*) filter (where i.status = 'terbit'),
             'sisa', coalesce(sum(i.total - i.potong_piutang) filter (where i.status = 'terbit'), 0),
             'penjualan_12_bulan', coalesce(sum(i.total) filter (where i.status <> 'batal' and i.tanggal > app.hari_ini(i.perusahaan_id) - 365), 0)) as x
      from public.invoice i
     where i.perusahaan_id = app.wajib_penagih()
     group by i.pelanggan, i.perusahaan_id
  ) s
$$;

-- Umur piutang M-01 memakai sisa piutang (total dikurangi uang muka dan retur).
create or replace function public.umur_piutang(p_per date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku(); v_baris jsonb; v_kel jsonb;
begin
  with b as (
    select i.nomor, i.pelanggan, (i.total - i.potong_piutang) as total, i.tanggal, i.jatuh_tempo, (p_per - i.jatuh_tempo) as hari,
           case when p_per <= i.jatuh_tempo then 'belum' when p_per - i.jatuh_tempo <= 30 then 'h1_30'
                when p_per - i.jatuh_tempo <= 60 then 'h31_60' when p_per - i.jatuh_tempo <= 90 then 'h61_90' else 'lebih_90' end as kelompok
      from public.invoice i
     where i.perusahaan_id = v_pid and i.status = 'terbit' and i.tanggal <= p_per and i.total > i.potong_piutang
  )
  select jsonb_agg(jsonb_build_object('nomor', nomor, 'pelanggan', pelanggan, 'total', total, 'tanggal', tanggal,
           'jatuh_tempo', jatuh_tempo, 'hari', hari, 'kelompok', kelompok) order by jatuh_tempo, nomor),
         jsonb_build_object('belum', coalesce(sum(total) filter (where kelompok = 'belum'), 0),
           'h1_30', coalesce(sum(total) filter (where kelompok = 'h1_30'), 0), 'h31_60', coalesce(sum(total) filter (where kelompok = 'h31_60'), 0),
           'h61_90', coalesce(sum(total) filter (where kelompok = 'h61_90'), 0), 'lebih_90', coalesce(sum(total) filter (where kelompok = 'lebih_90'), 0),
           'total', coalesce(sum(total), 0))
    into v_baris, v_kel from b;
  return jsonb_build_object('per', p_per, 'baris', coalesce(v_baris, '[]'), 'kelompok', v_kel);
end $$;

revoke all on function app.akun_pastikan(uuid, text, text, text, text), app.rapikan_baris_jual(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.buat_dokumen_jual(text, uuid, text, text, jsonb, date, text, uuid), public.terima_uang_muka(uuid, bigint, text, uuid),
  public.invoice_dari_dokumen(uuid, numeric, date, uuid), public.lunas_dipotong(uuid, text, date, bigint, text),
  public.retur_jual(uuid, jsonb, text, uuid), public.saldo_pelanggan() from public, anon;
grant execute on function public.buat_dokumen_jual(text, uuid, text, text, jsonb, date, text, uuid), public.terima_uang_muka(uuid, bigint, text, uuid),
  public.invoice_dari_dokumen(uuid, numeric, date, uuid), public.lunas_dipotong(uuid, text, date, bigint, text),
  public.retur_jual(uuid, jsonb, text, uuid), public.saldo_pelanggan() to authenticated;
