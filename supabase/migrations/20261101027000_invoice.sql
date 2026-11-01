-- F4-05 Invoice yang menagih sendiri (docs/research/invoice.md). Invoice terbit langsung bernomor (Nomor Sakti jenis INV) dan
-- berkode verifikasi untuk halaman publik /i/<kode>; terbit = jurnal 1-200 / 4-100, lunas = 1-100 (tunai) atau 1-110 (QRIS,
-- transfer) / 1-200, batal = jurnal balik. Pengingat bertahap (H-3, H0, H+3, H+14 dari jatuh tempo) ditulis saat terbit dan
-- muncul di layar pemilik pada harinya; pemilik sendiri yang mengirim lewat wa.me (Nadi tidak mengirim pesan). QRIS statis
-- pemilik disimpan apa adanya (diperiksa CRC di server action dengan uraiQris) dan tidak pernah diubah. Hak: pemilik, admin,
-- akuntan lewat app.peran_aktif(); tujuan pembayaran (QRIS, rekening) hanya diubah pemilik. Tes: supabase/tests/invoice.test.sql.

create table public.bayar_usaha (
  id uuid not null default app.uuid7() unique,
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  qris text check (qris is null or (length(qris) between 30 and 512 and qris ~ '^000201')),
  qris_nama text check (qris_nama is null or length(qris_nama) between 1 and 25),
  qris_nmid text check (qris_nmid is null or length(qris_nmid) <= 30),
  rekening text check (rekening is null or length(btrim(rekening)) between 1 and 200),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now(),
  check ((qris is null) = (qris_nama is null))
);

create table public.invoice (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nomor text not null,
  nomor_terbit_id uuid not null references public.nomor_terbit(id),
  kode_verifikasi text not null unique check (kode_verifikasi ~ '^[A-HJ-NP-Z2-9]{12}$'),
  pelanggan text not null check (length(btrim(pelanggan)) between 1 and 100),
  pelanggan_hp text check (pelanggan_hp is null or pelanggan_hp ~ '^62[0-9]{8,13}$'),
  baris jsonb not null check (jsonb_typeof(baris) = 'array' and jsonb_array_length(baris) between 1 and 30),
  total bigint not null check (total > 0),
  tanggal date not null,
  jatuh_tempo date not null check (jatuh_tempo >= tanggal),
  catatan text check (catatan is null or length(catatan) <= 300),
  status text not null default 'terbit' check (status in ('terbit', 'lunas', 'batal')),
  jurnal_terbit uuid,
  jurnal_lunas uuid,
  lunas_tanggal date,
  lunas_cara text check (lunas_cara is null or lunas_cara in ('qris', 'transfer', 'tunai')),
  lunas_oleh uuid,
  alasan_batal text check (alasan_batal is null or length(alasan_batal) <= 300),
  batal_at timestamptz,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, id),
  check ((status = 'lunas') = (lunas_tanggal is not null and lunas_cara is not null)),
  check ((status = 'batal') = (alasan_batal is not null))
);
create index on public.invoice (perusahaan_id, status, jatuh_tempo);
create index on public.invoice (nomor_terbit_id);

create table public.pengingat_invoice (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null,
  invoice_id uuid not null,
  tahap smallint not null check (tahap between 1 and 4),
  tanggal date not null,
  status text not null default 'jadwal' check (status in ('jadwal', 'dikirim', 'tidak_perlu')),
  dikirim_at timestamptz,
  dikirim_oleh uuid,
  unique (invoice_id, tahap),
  foreign key (perusahaan_id, invoice_id) references public.invoice (perusahaan_id, id) on delete cascade,
  check ((status = 'dikirim') = (dikirim_at is not null))
);
create index on public.pengingat_invoice (perusahaan_id, tanggal) where status = 'jadwal';

alter table public.bayar_usaha enable row level security;
alter table public.invoice enable row level security;
alter table public.pengingat_invoice enable row level security;
create policy bayar_usaha_baca on public.bayar_usaha for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy invoice_baca on public.invoice for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
create policy pengingat_invoice_baca on public.pengingat_invoice for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.bayar_usaha, public.invoice, public.pengingat_invoice to authenticated;

create trigger audit_bayar_usaha after insert or update or delete on public.bayar_usaha for each row execute function app.catat_audit();
create trigger audit_invoice after insert or update or delete on public.invoice for each row execute function app.catat_audit();

create or replace function app.wajib_penagih() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang mengurus invoice' using errcode = '42501';
  end if;
  return v_pid;
end $$;

-- Tujuan pembayaran: hanya pemilik (mengganti QRIS berarti mengganti ke mana uang pelanggan masuk).
create or replace function public.atur_bayar(p_qris text, p_qris_nama text, p_qris_nmid text, p_rekening text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mengatur QRIS dan rekening tujuan bayar' using errcode = '42501';
  end if;
  insert into public.bayar_usaha (perusahaan_id, qris, qris_nama, qris_nmid, rekening, diubah_oleh)
  values (v_pid, nullif(btrim(p_qris), ''), nullif(btrim(p_qris_nama), ''), nullif(btrim(p_qris_nmid), ''), nullif(btrim(p_rekening), ''), auth.uid())
  on conflict (perusahaan_id) do update
    set qris = excluded.qris, qris_nama = excluded.qris_nama, qris_nmid = excluded.qris_nmid, rekening = excluded.rekening,
        diubah_oleh = excluded.diubah_oleh, diubah_at = now();
end $$;

-- Buat dan terbitkan invoice (idempoten per kunci klien). Baris: [{uraian, jumlah, harga}], total = jumlah x harga dibulatkan
-- per baris (sama dengan totalBaris di apps/web/src/lib/invoice/tagihan.ts).
create or replace function public.buat_invoice(p_pelanggan text, p_hp text, p_baris jsonb, p_jatuh_tempo date, p_catatan text, p_kunci uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.wajib_penagih(); v_hari date; v_id uuid; v_total numeric := 0; v_baris jsonb := '[]'::jsonb; e jsonb;
  v_jml numeric; v_hrg numeric; v_uraian text; r jsonb; v_kode text; v_jurnal jsonb; i int; v_off int[] := array[-3, 0, 3, 14];
  inv public.invoice;
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
    exception when others then
      raise exception 'Jumlah dan harga harus angka.' using errcode = '22023';
    end;
    if length(v_uraian) not between 1 and 120 or v_jml is null or v_jml <= 0 or v_jml > 100000 or v_hrg is null or v_hrg < 0
       or v_hrg <> trunc(v_hrg) or v_hrg > 1000000000000 then
      raise exception 'Setiap baris butuh uraian, jumlah lebih dari 0, dan harga rupiah bulat.' using errcode = '22023';
    end if;
    v_total := v_total + round(v_jml * v_hrg);
    v_baris := v_baris || jsonb_build_array(jsonb_build_object('uraian', v_uraian, 'jumlah', v_jml, 'harga', v_hrg::bigint));
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

create or replace function public.tandai_lunas(p_id uuid, p_cara text, p_tanggal date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice; v_tgl date; v_jurnal jsonb;
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
  v_jurnal := app.posting_jurnal(v_pid,
    jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Pelunasan ' || inv.nomor || ' ' || inv.pelanggan, 200), 'sumber', 'invoice',
                       'sumber_id', inv.id::text, 'kunci_idempoten', 'invoice-lunas:' || inv.id),
    jsonb_build_array(jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'debit', inv.total),
                      jsonb_build_object('akun', '1-200', 'kredit', inv.total)),
    auth.uid());
  update public.invoice set status = 'lunas', lunas_tanggal = v_tgl, lunas_cara = p_cara, lunas_oleh = auth.uid(),
         jurnal_lunas = (v_jurnal ->> 'id')::uuid where id = inv.id;
  update public.pengingat_invoice set status = 'tidak_perlu' where invoice_id = inv.id and status = 'jadwal';
  return jsonb_build_object('id', inv.id, 'sudah', false);
end $$;

create or replace function public.batal_invoice(p_id uuid, p_alasan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); inv public.invoice;
begin
  if length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Tulis alasan invoice dibatalkan.' using errcode = '22023';
  end if;
  select * into inv from public.invoice where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Invoice tidak ditemukan' using errcode = 'P0002'; end if;
  if inv.status = 'batal' then return jsonb_build_object('id', inv.id, 'sudah', true); end if;
  if inv.status = 'lunas' then raise exception 'Invoice yang sudah lunas tidak bisa dibatalkan.' using errcode = '22023'; end if;
  perform public.balik_jurnal(inv.jurnal_terbit, 'Invoice ' || inv.nomor || ' dibatalkan: ' || btrim(p_alasan));
  update public.nomor_terbit set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), dibatalkan_oleh = auth.uid(), dibatalkan_at = now()
   where id = inv.nomor_terbit_id and status = 'terbit';
  update public.invoice set status = 'batal', alasan_batal = left(btrim(p_alasan), 300), batal_at = now() where id = inv.id;
  update public.pengingat_invoice set status = 'tidak_perlu' where invoice_id = inv.id and status = 'jadwal';
  return jsonb_build_object('id', inv.id, 'sudah', false);
end $$;

create or replace function public.catat_pengingat(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih();
begin
  update public.pengingat_invoice p set status = 'dikirim', dikirim_at = now(), dikirim_oleh = auth.uid()
    from public.invoice i
   where p.id = p_id and p.perusahaan_id = v_pid and i.id = p.invoice_id and i.status = 'terbit' and p.status = 'jadwal';
end $$;

-- Ringkasan layar: umur piutang (invoice terbit belum lunas) dan pengingat yang jadwalnya hari ini atau sudah lewat.
create or replace function public.ringkasan_invoice() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); v_hari date;
begin
  v_hari := app.hari_ini(v_pid);
  return jsonb_build_object(
    'hari', v_hari,
    'umur', (select coalesce(jsonb_object_agg(k.kelompok, jsonb_build_object('n', k.n, 'total', k.total)), '{}'::jsonb)
               from (select case when v_hari - i.jatuh_tempo <= 0 then 'belum' when v_hari - i.jatuh_tempo <= 30 then '1-30'
                                 when v_hari - i.jatuh_tempo <= 60 then '31-60' when v_hari - i.jatuh_tempo <= 90 then '61-90' else '90+' end as kelompok,
                            count(*) as n, sum(i.total) as total
                       from public.invoice i where i.perusahaan_id = v_pid and i.status = 'terbit' group by 1) k),
    'pengingat', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'tahap', p.tahap, 'tanggal', p.tanggal, 'invoice', i.id,
                    'nomor', i.nomor, 'pelanggan', i.pelanggan, 'hp', i.pelanggan_hp, 'total', i.total, 'jatuh_tempo', i.jatuh_tempo,
                    'kode', i.kode_verifikasi) order by p.tanggal, i.nomor), '[]'::jsonb)
                    from public.pengingat_invoice p join public.invoice i on i.id = p.invoice_id
                   where p.perusahaan_id = v_pid and p.status = 'jadwal' and p.tanggal <= v_hari and i.status = 'terbit'
                     -- Hanya tahap terbaru yang sudah tiba per invoice: pengingat lama yang terlewat tidak ikut menumpuk.
                     and not exists (select 1 from public.pengingat_invoice q where q.invoice_id = p.invoice_id and q.tahap > p.tahap and q.tanggal <= v_hari)));
end $$;

-- Halaman publik pelanggan /i/<kode>: tanpa nomor HP pelanggan dan tanpa data lain usaha.
create or replace function public.invoice_publik(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'nomor', i.nomor, 'pelanggan', i.pelanggan, 'baris', i.baris, 'total', i.total,
                            'tanggal', i.tanggal, 'jatuh_tempo', i.jatuh_tempo, 'catatan', i.catatan, 'status', i.status,
                            'lunas_tanggal', i.lunas_tanggal, 'qris', b.qris, 'qris_nama', b.qris_nama, 'rekening', b.rekening)
    from public.invoice i join public.perusahaan p on p.id = i.perusahaan_id left join public.bayar_usaha b on b.perusahaan_id = i.perusahaan_id
   where i.kode_verifikasi = upper(regexp_replace(coalesce(p_kode, ''), '[\s-]', '', 'g'))
$$;

revoke all on function app.wajib_penagih() from public, anon, authenticated;
revoke all on function public.atur_bayar(text, text, text, text), public.buat_invoice(text, text, jsonb, date, text, uuid),
  public.tandai_lunas(uuid, text, date), public.batal_invoice(uuid, text), public.catat_pengingat(uuid), public.ringkasan_invoice(),
  public.invoice_publik(text) from public, anon;
grant execute on function public.atur_bayar(text, text, text, text), public.buat_invoice(text, text, jsonb, date, text, uuid),
  public.tandai_lunas(uuid, text, date), public.batal_invoice(uuid, text), public.catat_pengingat(uuid), public.ringkasan_invoice()
  to authenticated;
grant execute on function public.invoice_publik(text) to anon, authenticated;
