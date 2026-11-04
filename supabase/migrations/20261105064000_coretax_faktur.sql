-- M-09 (docs/research/coretax-efaktur.md): data untuk berkas impor XML Faktur Pajak Keluaran Coretax (TaxInvoiceBulk, templat
-- DJP Sample Faktur PK v.1.4/1.6.1). Identitas pajak penjual (NPWP 16 digit, NITKU 22 digit, PKP, harga invoice termasuk PPN,
-- kode transaksi bawaan) dan identitas pembeli per nama pelanggan (jenis ID TIN/National ID/Passport/Other ID, nomor, NITKU,
-- alamat, email) hanya untuk pemilik, admin, akuntan. Nadi tidak mengirim apa pun ke Coretax; pemilik mengunggah berkasnya sendiri.
-- Tes: supabase/tests/coretax_faktur.test.sql.

create table public.identitas_pajak (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  npwp text not null check (npwp ~ '^[0-9]{16}$'),
  nitku text not null check (nitku ~ '^[0-9]{22}$' and left(nitku, 16) = npwp),
  pkp boolean not null default true,
  harga_termasuk_ppn boolean not null default true,
  kode_transaksi text not null default '04' check (kode_transaksi in ('01', '04')),
  diubah_oleh uuid,
  diubah_at timestamptz not null default now()
);
alter table public.identitas_pajak enable row level security;
create policy identitas_pajak_baca on public.identitas_pajak for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.identitas_pajak to authenticated;

create table public.pembeli_pajak (
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kunci text not null,
  nama text not null check (length(btrim(nama)) between 1 and 100),
  jenis_id text not null check (jenis_id in ('TIN', 'National ID', 'Passport', 'Other ID')),
  nomor_id text not null check (length(btrim(nomor_id)) between 1 and 40),
  nitku text check (nitku is null or nitku ~ '^[0-9]{22}$'),
  alamat text not null check (length(btrim(alamat)) between 1 and 300),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  diubah_at timestamptz not null default now(),
  primary key (perusahaan_id, kunci),
  check (jenis_id <> 'TIN' or (nomor_id ~ '^[0-9]{16}$' and nitku is not null and left(nitku, 16) = nomor_id)),
  check (jenis_id <> 'National ID' or nomor_id ~ '^[0-9]{16}$')
);
alter table public.pembeli_pajak enable row level security;
create policy pembeli_pajak_baca on public.pembeli_pajak for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.pembeli_pajak to authenticated;

create or replace function app.wajib_pengurus_pajak() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang mengurus faktur pajak.' using errcode = '42501';
  end if;
  return v_pid;
end $$;
revoke all on function app.wajib_pengurus_pajak() from public, anon, authenticated;

create or replace function public.simpan_identitas_pajak(p_npwp text, p_nitku text, p_pkp boolean, p_termasuk boolean, p_kode text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak(); v_npwp text := regexp_replace(coalesce(p_npwp, ''), '[^0-9]', '', 'g');
  v_nitku text := regexp_replace(coalesce(p_nitku, ''), '[^0-9]', '', 'g');
begin
  if v_npwp !~ '^[0-9]{16}$' then raise exception 'NPWP harus 16 angka (NIK atau NPWP 16 digit).' using errcode = '22023'; end if;
  if v_nitku = '' then v_nitku := v_npwp || '000000'; end if;
  if v_nitku !~ '^[0-9]{22}$' or left(v_nitku, 16) <> v_npwp then
    raise exception 'NITKU harus 22 angka dan diawali NPWP-mu, mis. NPWP + 000000 untuk tempat usaha utama.' using errcode = '22023';
  end if;
  insert into public.identitas_pajak (perusahaan_id, npwp, nitku, pkp, harga_termasuk_ppn, kode_transaksi, diubah_oleh)
  values (v_pid, v_npwp, v_nitku, coalesce(p_pkp, true), coalesce(p_termasuk, true), coalesce(p_kode, '04'), auth.uid())
  on conflict (perusahaan_id) do update set npwp = excluded.npwp, nitku = excluded.nitku, pkp = excluded.pkp,
    harga_termasuk_ppn = excluded.harga_termasuk_ppn, kode_transaksi = excluded.kode_transaksi, diubah_oleh = excluded.diubah_oleh, diubah_at = now();
end $$;

create or replace function public.simpan_pembeli_pajak(p_nama text, p_jenis text, p_nomor text, p_nitku text, p_alamat text, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak(); v_nomor text := btrim(coalesce(p_nomor, '')); v_nitku text := nullif(regexp_replace(coalesce(p_nitku, ''), '[^0-9]', '', 'g'), '');
begin
  if p_jenis in ('TIN', 'National ID') then v_nomor := regexp_replace(v_nomor, '[^0-9]', '', 'g'); end if;
  if p_jenis = 'TIN' and v_nitku is null and v_nomor ~ '^[0-9]{16}$' then v_nitku := v_nomor || '000000'; end if;
  if p_jenis <> 'TIN' then v_nitku := null; end if;
  insert into public.pembeli_pajak (perusahaan_id, kunci, nama, jenis_id, nomor_id, nitku, alamat, email)
  values (v_pid, lower(btrim(coalesce(p_nama, ''))), btrim(coalesce(p_nama, '')), p_jenis, v_nomor, v_nitku, btrim(coalesce(p_alamat, '')), nullif(btrim(coalesce(p_email, '')), ''))
  on conflict (perusahaan_id, kunci) do update set nama = excluded.nama, jenis_id = excluded.jenis_id, nomor_id = excluded.nomor_id,
    nitku = excluded.nitku, alamat = excluded.alamat, email = excluded.email, diubah_at = now();
exception when check_violation or not_null_violation then
  raise exception 'Data pembeli belum benar: NPWP/NIK 16 angka, NITKU 22 angka diawali NPWP, alamat wajib diisi.' using errcode = '22023';
end $$;

-- Invoice satu bulan (tidak batal) beserta identitas pembeli bila sudah diisi; dasar berkas XML yang disusun di aplikasi.
create or replace function public.data_faktur_keluaran(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak(); v_awal date := date_trunc('month', p_bulan)::date;
begin
  return jsonb_build_object(
    'identitas', (select to_jsonb(i) - 'perusahaan_id' - 'diubah_oleh' from public.identitas_pajak i where i.perusahaan_id = v_pid),
    'faktur', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'nomor', v.nomor, 'tanggal', v.tanggal, 'pelanggan', v.pelanggan, 'baris', v.baris,
        'total', v.total, 'pembeli', (select to_jsonb(b) - 'perusahaan_id' from public.pembeli_pajak b where b.perusahaan_id = v_pid and b.kunci = lower(btrim(v.pelanggan))))
        order by v.tanggal, v.nomor)
      from public.invoice v where v.perusahaan_id = v_pid and v.status <> 'batal' and v.tanggal >= v_awal and v.tanggal < (v_awal + interval '1 month')::date), '[]'::jsonb));
end $$;

revoke all on function public.simpan_identitas_pajak(text, text, boolean, boolean, text), public.simpan_pembeli_pajak(text, text, text, text, text, text),
  public.data_faktur_keluaran(date) from public, anon;
grant execute on function public.simpan_identitas_pajak(text, text, boolean, boolean, text), public.simpan_pembeli_pajak(text, text, text, text, text, text),
  public.data_faktur_keluaran(date) to authenticated;
