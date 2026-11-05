-- M-16B layanan lanjutan (menutup QO-13, QO-14, QO-15 pengganti tanpa WhatsApp API, QO-02 templat; tes supabase/tests/janji_katalog_poin.test.sql):
--   - janji temu publik: layanan berdurasi, jam buka per hari, slot per jeda; pemesanan dari /janji/<kunci> tanpa akun; dua janji
--     tidak bisa bertumpuk di usaha yang sama (exclusion constraint gist, juga saat dua orang memesan bersamaan);
--   - katalog publik /katalog/<kunci>: produk aktif berharga, tombol pesan membuka wa.me berisi teks pesanan (tanpa WhatsApp API);
--   - poin loyalitas: dihitung dari invoice lunas 365 hari per nama pelanggan (1 poin per Rp kelipatan), penukaran dicatat dan
--     tidak bisa melebihi sisa;
--   - templat balasan agen untuk layanan pelanggan (M-16).
-- Kunci halaman publik acak dan terpisah dari kode usaha. Batas: 30 janji publik per usaha per hari.

create table public.booking_setting (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  kunci text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  aktif boolean not null default true,
  jam_mulai time not null default '09:00',
  jam_selesai time not null default '17:00',
  hari_buka int[] not null default '{1,2,3,4,5,6}' check (hari_buka <@ '{1,2,3,4,5,6,7}' and cardinality(hari_buka) >= 1),
  jeda_menit int not null default 30 check (jeda_menit in (15, 30, 60)),
  diubah_at timestamptz not null default now(),
  check (jam_mulai < jam_selesai)
);

create table public.appointment_service (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  nama text not null check (length(btrim(nama)) between 2 and 80),
  durasi_menit int not null check (durasi_menit between 15 and 480),
  harga bigint not null default 0 check (harga between 0 and 1000000000),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, id)
);

create table public.appointment (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  layanan_id uuid not null,
  kode text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  mulai timestamptz not null,
  selesai timestamptz not null,
  nama text not null check (length(btrim(nama)) between 2 and 80),
  hp text check (hp is null or hp ~ '^62[0-9]{8,13}$'),
  catatan text check (catatan is null or length(catatan) <= 300),
  status text not null default 'dipesan' check (status in ('dipesan', 'datang', 'batal')),
  dibuat_at timestamptz not null default now(),
  foreign key (perusahaan_id, layanan_id) references public.appointment_service (perusahaan_id, id),
  check (selesai > mulai),
  constraint appointment_tidak_bentrok exclude using gist (perusahaan_id with =, tstzrange(mulai, selesai, '[)') with &&) where (status <> 'batal')
);
create index on public.appointment (perusahaan_id, mulai);

create table public.catalog_setting (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  kunci text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  aktif boolean not null default true,
  wa text not null check (wa ~ '^62[0-9]{8,13}$'),
  diubah_at timestamptz not null default now()
);

create table public.loyalty_setting (
  perusahaan_id uuid primary key references public.perusahaan(id) on delete cascade,
  aktif boolean not null default true,
  rp_per_poin bigint not null default 10000 check (rp_per_poin between 100 and 100000000),
  diubah_at timestamptz not null default now()
);

create table public.loyalty_redeem (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  pelanggan text not null check (length(btrim(pelanggan)) between 1 and 100),
  poin int not null check (poin > 0),
  keterangan text not null check (length(btrim(keterangan)) between 3 and 200),
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now()
);
create index on public.loyalty_redeem (perusahaan_id, lower(btrim(pelanggan)));

create table public.reply_template (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  judul text not null check (length(btrim(judul)) between 2 and 60),
  isi text not null check (length(btrim(isi)) between 2 and 2000),
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, judul)
);

alter table public.booking_setting enable row level security;
alter table public.appointment_service enable row level security;
alter table public.appointment enable row level security;
alter table public.catalog_setting enable row level security;
alter table public.loyalty_setting enable row level security;
alter table public.loyalty_redeem enable row level security;
alter table public.reply_template enable row level security;
create policy booking_setting_baca on public.booking_setting for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy appointment_service_baca on public.appointment_service for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'staf'));
create policy appointment_baca on public.appointment for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'staf'));
create policy catalog_setting_baca on public.catalog_setting for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy loyalty_setting_baca on public.loyalty_setting for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy loyalty_redeem_baca on public.loyalty_redeem for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
create policy reply_template_baca on public.reply_template for select to authenticated using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'staf'));
grant select on public.booking_setting, public.appointment_service, public.appointment, public.catalog_setting, public.loyalty_setting,
  public.loyalty_redeem, public.reply_template to authenticated;

create or replace function app.hp62(p text) returns text
language sql immutable set search_path = '' as $$
  select case when x ~ '^0' then '62' || substr(x, 2) else x end from (select nullif(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '') x) s
$$;

-- ---------- pengelola ----------
create or replace function public.save_booking_setting(p_aktif boolean, p_mulai time, p_selesai time, p_hari int[], p_jeda int) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v text;
begin
  if p_mulai is null or p_selesai is null or p_mulai >= p_selesai then raise exception 'Jam buka harus sebelum jam tutup' using errcode = '22023'; end if;
  if p_hari is null or cardinality(p_hari) = 0 or not (p_hari <@ '{1,2,3,4,5,6,7}') then raise exception 'Pilih hari buka (1 Senin sampai 7 Minggu)' using errcode = '22023'; end if;
  if coalesce(p_jeda, 0) not in (15, 30, 60) then raise exception 'Jeda slot 15, 30, atau 60 menit' using errcode = '22023'; end if;
  insert into public.booking_setting (perusahaan_id, aktif, jam_mulai, jam_selesai, hari_buka, jeda_menit) values (v_pid, coalesce(p_aktif, true), p_mulai, p_selesai, p_hari, p_jeda)
  on conflict (perusahaan_id) do update set aktif = excluded.aktif, jam_mulai = excluded.jam_mulai, jam_selesai = excluded.jam_selesai,
    hari_buka = excluded.hari_buka, jeda_menit = excluded.jeda_menit, diubah_at = now()
  returning kunci into v;
  return v;
end $$;

create or replace function public.save_appointment_service(p_id uuid, p_nama text, p_durasi int, p_harga bigint, p_aktif boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v uuid;
begin
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 80 then raise exception 'Nama layanan 2 sampai 80 huruf' using errcode = '22023'; end if;
  if p_durasi is null or p_durasi not between 15 and 480 then raise exception 'Durasi 15 sampai 480 menit' using errcode = '22023'; end if;
  if p_harga is null or p_harga < 0 then raise exception 'Isi harga dalam rupiah (0 bila gratis)' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.appointment_service (perusahaan_id, nama, durasi_menit, harga, aktif) values (v_pid, btrim(p_nama), p_durasi, p_harga, coalesce(p_aktif, true)) returning id into v;
  else
    update public.appointment_service set nama = btrim(p_nama), durasi_menit = p_durasi, harga = p_harga, aktif = coalesce(p_aktif, aktif) where id = p_id and perusahaan_id = v_pid returning id into v;
    if v is null then raise exception 'Layanan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v;
end $$;

create or replace function public.set_appointment_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  if p_status not in ('dipesan', 'datang', 'batal') then raise exception 'Status tidak dikenal' using errcode = '22023'; end if;
  update public.appointment set status = p_status where id = p_id and perusahaan_id = v_pid;
  if not found then raise exception 'Janji temu tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

create or replace function public.save_catalog_setting(p_aktif boolean, p_wa text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_wa text := app.hp62(p_wa); v text;
begin
  if v_wa is null or v_wa !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp belum benar, mis. 0812-3456-7890' using errcode = '22023'; end if;
  insert into public.catalog_setting (perusahaan_id, aktif, wa) values (v_pid, coalesce(p_aktif, true), v_wa)
  on conflict (perusahaan_id) do update set aktif = excluded.aktif, wa = excluded.wa, diubah_at = now()
  returning kunci into v;
  return v;
end $$;

create or replace function public.save_loyalty_setting(p_aktif boolean, p_rp bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  if p_rp is null or p_rp not between 100 and 100000000 then raise exception 'Rupiah per poin antara Rp100 dan Rp100.000.000' using errcode = '22023'; end if;
  insert into public.loyalty_setting (perusahaan_id, aktif, rp_per_poin) values (v_pid, coalesce(p_aktif, true), p_rp)
  on conflict (perusahaan_id) do update set aktif = excluded.aktif, rp_per_poin = excluded.rp_per_poin, diubah_at = now();
end $$;

-- Poin per pelanggan: floor(jumlah invoice lunas 365 hari / rp_per_poin) dikurangi penukaran. Nama dicocokkan tanpa beda huruf besar.
create or replace function app.loyalty_table(p_pid uuid) returns table (kunci text, pelanggan text, belanja bigint, dapat int, ditukar int, sisa int)
language sql stable security definer set search_path = '' as $$
  with s as (select rp_per_poin from public.loyalty_setting where perusahaan_id = p_pid and aktif),
  i as (select lower(btrim(pelanggan)) k, min(btrim(pelanggan)) nama, sum(total)::bigint b from public.invoice
         where perusahaan_id = p_pid and status = 'lunas' and tanggal > app.hari_ini(p_pid) - 365 group by 1),
  r as (select lower(btrim(pelanggan)) k, sum(poin)::int p from public.loyalty_redeem where perusahaan_id = p_pid group by 1)
  select i.k, i.nama, i.b, (i.b / s.rp_per_poin)::int, coalesce(r.p, 0), ((i.b / s.rp_per_poin)::int - coalesce(r.p, 0))
    from i cross join s left join r on r.k = i.k
$$;

create or replace function public.loyalty_points() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('pelanggan', pelanggan, 'belanja', belanja, 'dapat', dapat, 'ditukar', ditukar, 'sisa', sisa) order by sisa desc, pelanggan)
    from app.loyalty_table(v_pid)), '[]');
end $$;

create or replace function public.redeem_points(p_pelanggan text, p_poin int, p_keterangan text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_sisa int;
begin
  if p_poin is null or p_poin <= 0 then raise exception 'Isi jumlah poin yang ditukar' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_keterangan, ''))) not between 3 and 200 then raise exception 'Tulis ditukar dengan apa' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_pid::text || lower(btrim(coalesce(p_pelanggan, ''))), 0));
  select sisa into v_sisa from app.loyalty_table(v_pid) where kunci = lower(btrim(coalesce(p_pelanggan, '')));
  if v_sisa is null then raise exception 'Pelanggan belum punya poin' using errcode = 'P0002'; end if;
  if p_poin > v_sisa then raise exception 'Poin tidak cukup: sisa %', v_sisa using errcode = '22023'; end if;
  insert into public.loyalty_redeem (perusahaan_id, pelanggan, poin, keterangan, dibuat_oleh) values (v_pid, btrim(p_pelanggan), p_poin, btrim(p_keterangan), auth.uid());
  return v_sisa - p_poin;
end $$;

create or replace function public.save_reply_template(p_judul text, p_isi text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v uuid;
begin
  if length(btrim(coalesce(p_judul, ''))) not between 2 and 60 or length(btrim(coalesce(p_isi, ''))) not between 2 and 2000 then
    raise exception 'Judul 2 sampai 60 huruf, isi 2 sampai 2000 huruf' using errcode = '22023';
  end if;
  insert into public.reply_template (perusahaan_id, judul, isi) values (v_pid, btrim(p_judul), btrim(p_isi))
  on conflict (perusahaan_id, judul) do update set isi = excluded.isi returning id into v;
  return v;
end $$;

-- ---------- publik ----------
create or replace function public.booking_info(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'hari_buka', b.hari_buka, 'jam_mulai', to_char(b.jam_mulai, 'HH24:MI'), 'jam_selesai', to_char(b.jam_selesai, 'HH24:MI'),
           'hari_ini', app.hari_ini(p.id),
           'layanan', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nama', s.nama, 'durasi', s.durasi_menit, 'harga', s.harga) order by s.nama)
                                  from public.appointment_service s where s.perusahaan_id = p.id and s.aktif), '[]'))
    from public.booking_setting b join public.perusahaan p on p.id = b.perusahaan_id where b.kunci = p_kunci and b.aktif
$$;

-- Slot kosong (jam mulai lokal HH:MI) untuk layanan pada tanggal: di hari buka, dalam jam buka, tidak bertumpuk janji lain,
-- dan paling cepat 30 menit dari sekarang. Tanggal paling jauh 60 hari ke depan.
create or replace function public.booking_slots(p_kunci text, p_layanan uuid, p_tanggal date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.booking_setting; s public.appointment_service; v_zona text; v jsonb;
begin
  select * into b from public.booking_setting where kunci = p_kunci and aktif;
  if not found then raise exception 'Janji temu tidak aktif' using errcode = 'P0002'; end if;
  select * into s from public.appointment_service where id = p_layanan and perusahaan_id = b.perusahaan_id and aktif;
  if not found then raise exception 'Layanan tidak ditemukan' using errcode = 'P0002'; end if;
  select coalesce(zona_waktu, 'Asia/Jakarta') into v_zona from public.perusahaan where id = b.perusahaan_id;
  if p_tanggal is null or p_tanggal < app.hari_ini(b.perusahaan_id) or p_tanggal > app.hari_ini(b.perusahaan_id) + 60 then return '[]'; end if;
  if not (extract(isodow from p_tanggal)::int = any(b.hari_buka)) then return '[]'; end if;
  select coalesce(jsonb_agg(to_char(t, 'HH24:MI') order by t), '[]') into v
    from generate_series(p_tanggal + b.jam_mulai, p_tanggal + b.jam_selesai - make_interval(mins => s.durasi_menit), make_interval(mins => b.jeda_menit)) t
   where (t at time zone v_zona) >= now() + interval '30 minutes'
     and not exists (select 1 from public.appointment a where a.perusahaan_id = b.perusahaan_id and a.status <> 'batal'
                      and tstzrange(a.mulai, a.selesai, '[)') && tstzrange(t at time zone v_zona, (t + make_interval(mins => s.durasi_menit)) at time zone v_zona, '[)'));
  return v;
end $$;

create or replace function public.book_appointment(p_kunci text, p_layanan uuid, p_tanggal date, p_jam text, p_nama text, p_hp text, p_catatan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.booking_setting; s public.appointment_service; v_zona text; v_mulai timestamptz; a public.appointment; v_hp text := app.hp62(p_hp);
begin
  select * into b from public.booking_setting where kunci = p_kunci and aktif;
  if not found then raise exception 'Janji temu tidak aktif' using errcode = 'P0002'; end if;
  if length(btrim(coalesce(p_nama, ''))) not between 2 and 80 then raise exception 'Tulis namamu 2 sampai 80 huruf' using errcode = '22023'; end if;
  if v_hp is not null and v_hp !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp belum benar' using errcode = '22023'; end if;
  if p_jam is null or p_jam !~ '^\d{2}:\d{2}$' then raise exception 'Pilih jam' using errcode = '22023'; end if;
  if not (public.booking_slots(p_kunci, p_layanan, p_tanggal) ? p_jam) then
    raise exception 'Jam itu tidak tersedia. Pilih jam lain.' using errcode = '22023';
  end if;
  if (select count(*) from public.appointment where perusahaan_id = b.perusahaan_id and dibuat_at > now() - interval '1 day') >= 30 then
    raise exception 'Pemesanan hari ini sudah penuh. Hubungi usahanya langsung.' using errcode = '53400';
  end if;
  select * into s from public.appointment_service where id = p_layanan;
  select coalesce(zona_waktu, 'Asia/Jakarta') into v_zona from public.perusahaan where id = b.perusahaan_id;
  v_mulai := (p_tanggal + p_jam::time) at time zone v_zona;
  begin
    insert into public.appointment (perusahaan_id, layanan_id, mulai, selesai, nama, hp, catatan)
    values (b.perusahaan_id, s.id, v_mulai, v_mulai + make_interval(mins => s.durasi_menit), btrim(p_nama), v_hp, nullif(left(btrim(coalesce(p_catatan, '')), 300), ''))
    returning * into a;
  exception when exclusion_violation then
    raise exception 'Jam itu baru saja dipesan orang lain. Pilih jam lain.' using errcode = '23P01';
  end;
  return jsonb_build_object('kode', a.kode, 'layanan', s.nama, 'tanggal', p_tanggal, 'jam', p_jam);
end $$;

create or replace function public.catalog_public(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usaha', p.nama, 'wa', c.wa,
           'produk', coalesce((select jsonb_agg(jsonb_build_object('nama', x.nama, 'harga', x.harga_jual, 'satuan', x.satuan, 'kategori', x.kategori) order by x.kategori nulls last, x.nama)
                                 from (select nama, harga_jual, satuan, kategori from public.produk where perusahaan_id = p.id and aktif and harga_jual > 0 order by nama limit 200) x), '[]'))
    from public.catalog_setting c join public.perusahaan p on p.id = c.perusahaan_id where c.kunci = p_kunci and c.aktif
$$;

revoke all on function app.hp62(text), app.loyalty_table(uuid) from public, anon, authenticated;
revoke all on function public.save_booking_setting(boolean, time, time, int[], int), public.save_appointment_service(uuid, text, int, bigint, boolean),
  public.set_appointment_status(uuid, text), public.save_catalog_setting(boolean, text), public.save_loyalty_setting(boolean, bigint),
  public.loyalty_points(), public.redeem_points(text, int, text), public.save_reply_template(text, text),
  public.booking_info(text), public.booking_slots(text, uuid, date), public.book_appointment(text, uuid, date, text, text, text, text), public.catalog_public(text) from public;
grant execute on function public.save_booking_setting(boolean, time, time, int[], int), public.save_appointment_service(uuid, text, int, bigint, boolean),
  public.set_appointment_status(uuid, text), public.save_catalog_setting(boolean, text), public.save_loyalty_setting(boolean, bigint),
  public.loyalty_points(), public.redeem_points(text, int, text), public.save_reply_template(text, text) to authenticated;
grant execute on function public.booking_info(text), public.booking_slots(text, uuid, date), public.book_appointment(text, uuid, date, text, text, text, text),
  public.catalog_public(text) to anon, authenticated;
