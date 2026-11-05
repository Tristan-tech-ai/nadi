-- W-07B order titipan/servis (docs/research/kebutuhan-usaha.md urut 2): bengkel, laundry, penjahit, servis elektronik memakai satu pola.
-- Barang pelanggan diterima dengan nomor tiket SRV, keluhan, perkiraan biaya, janji selesai; status hanya maju
-- (diterima > dikerjakan > selesai > diambil) atau batal sebelum diambil, setiap langkah tercatat di riwayat; invoice dibuat dari tiket
-- lewat buat_invoice (kunci per tiket, jadi sekali saja); pelanggan melihat status lewat /servis/<kode acak 12 heksa> tanpa akun.
-- Semua anggota aktif boleh menerima dan memajukan tiket (petugas loket); invoice hanya pemilik/admin/akuntan.

create table public.service_order (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nomor text not null,
  kode text not null unique default upper(encode(extensions.gen_random_bytes(6), 'hex')),
  pelanggan text not null check (length(btrim(pelanggan)) between 1 and 100),
  pelanggan_hp text check (pelanggan_hp is null or pelanggan_hp ~ '^62[0-9]{8,13}$'),
  item text not null check (length(btrim(item)) between 2 and 160),
  keluhan text check (keluhan is null or length(keluhan) <= 500),
  estimasi bigint check (estimasi is null or estimasi >= 0),
  janji_selesai date,
  status text not null default 'diterima' check (status in ('diterima', 'dikerjakan', 'selesai', 'diambil', 'batal')),
  riwayat jsonb not null default '[]' check (jsonb_typeof(riwayat) = 'array'),
  invoice_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  unique (perusahaan_id, nomor)
);
create index service_order_aktif on public.service_order (perusahaan_id, status, dibuat_at desc);
alter table public.service_order enable row level security;
create policy service_order_baca on public.service_order for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
grant select on public.service_order to authenticated;
create trigger audit_service_order after insert or update or delete on public.service_order for each row execute function app.catat_audit();

create or replace function app.service_rank(p_status text) returns integer
language sql immutable set search_path = '' as $$
  select case p_status when 'diterima' then 1 when 'dikerjakan' then 2 when 'selesai' then 3 when 'diambil' then 4 else 0 end
$$;

create or replace function public.create_service_order(p jsonb, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); s public.service_order; r jsonb; v_hp text := nullif(btrim(coalesce(p ->> 'hp', '')), ''); v_janji date := nullif(p ->> 'janji', '')::date;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into s from public.service_order where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', s.id, 'nomor', s.nomor, 'kode', s.kode, 'baru', false); end if;
  if v_hp is not null and v_hp !~ '^62[0-9]{8,13}$' then raise exception 'Nomor HP pelanggan diawali 62, misalnya 6281234567890' using errcode = '22023'; end if;
  if v_janji is not null and v_janji < app.hari_ini(v_pid) then raise exception 'Janji selesai tidak boleh sebelum hari ini' using errcode = '22023'; end if;
  insert into public.templat_nomor (perusahaan_id, jenis, nama, templat) values (v_pid, 'SRV', 'Order servis/titipan', '{no:3}/SRV/{bulan_romawi}/{tahun}')
  on conflict (perusahaan_id, jenis) do nothing;
  r := app.terbit_nomor(v_pid, 'SRV', 'order servis ' || p_kunci, auth.uid());
  insert into public.service_order (perusahaan_id, nomor, pelanggan, pelanggan_hp, item, keluhan, estimasi, janji_selesai, riwayat, kunci_klien, dibuat_oleh)
  values (v_pid, r ->> 'nomor', btrim(p ->> 'pelanggan'), v_hp, btrim(p ->> 'item'), nullif(left(btrim(coalesce(p ->> 'keluhan', '')), 500), ''),
          nullif(p ->> 'estimasi', '')::bigint, v_janji, jsonb_build_array(jsonb_build_object('status', 'diterima', 'at', now())), p_kunci, auth.uid())
  returning * into s;
  return jsonb_build_object('id', s.id, 'nomor', s.nomor, 'kode', s.kode, 'baru', true);
end $$;

-- Status hanya maju satu atau lebih langkah; batal hanya sebelum diambil. Langkah ke status yang sama diabaikan (klik ganda).
create or replace function public.advance_service_order(p_id uuid, p_status text, p_catatan text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); s public.service_order;
begin
  select * into s from public.service_order where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Order tidak ditemukan' using errcode = 'P0002'; end if;
  if p_status = s.status then return s.status; end if;
  if s.status in ('diambil', 'batal') then raise exception 'Order % sudah %', s.nomor, s.status using errcode = '22023'; end if;
  if p_status = 'batal' then
    if length(btrim(coalesce(p_catatan, ''))) < 3 then raise exception 'Tulis alasan batal' using errcode = '22023'; end if;
  elsif app.service_rank(p_status) = 0 then
    raise exception 'Status tidak dikenal' using errcode = '22023';
  elsif app.service_rank(p_status) < app.service_rank(s.status) then
    raise exception 'Status tidak bisa mundur dari % ke %', s.status, p_status using errcode = '22023';
  end if;
  update public.service_order set status = p_status,
         riwayat = riwayat || jsonb_build_object('status', p_status, 'at', now(), 'catatan', nullif(left(btrim(coalesce(p_catatan, '')), 200), ''))
   where id = s.id;
  return p_status;
end $$;

-- Invoice dari tiket (sekali per tiket): baris [{uraian, jumlah, harga, produk?}]; stok suku cadang ikut berkurang lewat buat_invoice.
create or replace function public.invoice_from_service_order(p_id uuid, p_baris jsonb, p_jatuh_tempo date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_penagih(); s public.service_order; x jsonb;
begin
  select * into s from public.service_order where id = p_id and perusahaan_id = v_pid for update;
  if not found then raise exception 'Order tidak ditemukan' using errcode = 'P0002'; end if;
  if s.status = 'batal' then raise exception 'Order batal tidak ditagih' using errcode = '22023'; end if;
  x := public.buat_invoice(s.pelanggan, s.pelanggan_hp, p_baris, coalesce(p_jatuh_tempo, app.hari_ini(v_pid)),
         'Order ' || s.nomor || ': ' || left(s.item, 120), md5('servis:' || s.id)::uuid);
  update public.service_order set invoice_id = (x ->> 'id')::uuid where id = s.id;
  return x;
end $$;

-- Status untuk pelanggan tanpa akun: tanpa nomor HP, tanpa catatan internal.
create or replace function public.service_status(p_kode text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'nomor', s.nomor, 'pelanggan', s.pelanggan, 'item', s.item, 'status', s.status, 'janji', s.janji_selesai,
           'estimasi', s.estimasi, 'diterima', s.dibuat_at, 'zona', p.zona_waktu,
           'riwayat', (select coalesce(jsonb_agg(jsonb_build_object('status', e ->> 'status', 'at', e ->> 'at')), '[]') from jsonb_array_elements(s.riwayat) e),
           'tagihan', (select i.kode_verifikasi from public.invoice i where i.id = s.invoice_id and i.status <> 'batal'))
    from public.service_order s join public.perusahaan p on p.id = s.perusahaan_id
   where s.kode = upper(btrim(coalesce(p_kode, ''))) and s.dibuat_at > now() - interval '180 days'
$$;

revoke all on function app.service_rank(text) from public, anon, authenticated;
revoke all on function public.create_service_order(jsonb, uuid), public.advance_service_order(uuid, text, text), public.invoice_from_service_order(uuid, jsonb, date),
  public.service_status(text) from public;
grant execute on function public.create_service_order(jsonb, uuid), public.advance_service_order(uuid, text, text), public.invoice_from_service_order(uuid, jsonb, date) to authenticated;
grant execute on function public.service_status(text) to anon, authenticated;
