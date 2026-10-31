-- Absen QR berputar (F1-02, docs/research/absen.md): kode TOTP 15 detik per tempat (RFC 6238, HMAC-SHA1), dihitung di database.
-- Rahasia tempat ada di skema app (tidak terbuka ke API). Kode diterima untuk langkah sekarang atau satu langkah sebelumnya, dan
-- tidak bisa dipakai dua kali oleh orang yang sama untuk jenis absen yang sama. Foto wajah tidak pernah dikirim ke server.

create table app.rahasia_tempat (
  tempat_id uuid primary key references public.tempat(id) on delete cascade,
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  rahasia bytea not null default extensions.gen_random_bytes(20),
  dibuat_at timestamptz not null default now()
);
revoke all on app.rahasia_tempat from public, anon, authenticated;

-- TOTP (RFC 6238) di atas HOTP (RFC 4226 §5.3 pemotongan dinamis).
create or replace function app.totp(p_kunci bytea, p_unix double precision, p_langkah integer default 30, p_digit integer default 6) returns text
language plpgsql immutable set search_path = '' as $$
declare t bigint := floor(p_unix / p_langkah)::bigint; h bytea; o integer; bin bigint;
begin
  h := extensions.hmac(int8send(t), p_kunci, 'sha1');
  o := get_byte(h, 19) & 15;
  bin := ((get_byte(h, o) & 127)::bigint << 24) | (get_byte(h, o + 1)::bigint << 16) | (get_byte(h, o + 2)::bigint << 8) | get_byte(h, o + 3)::bigint;
  return lpad((bin % (10::bigint ^ p_digit)::bigint)::text, p_digit, '0');
end $$;
revoke all on function app.totp(bytea, double precision, integer, integer) from public, anon, authenticated;

-- Tempat absen utama usaha aktif (dibuat bila belum ada). Pemilik/admin saja.
create or replace function public.tempat_absen_utama() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_id uuid;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  select id into v_id from public.tempat where perusahaan_id = v_pid and aktif and jenis = 'lokasi' and induk_id is null order by id limit 1;
  if v_id is null then
    insert into public.tempat (perusahaan_id, jalur, nama, jenis) values (v_pid, 'utama'::extensions.ltree, 'Tempat utama', 'lokasi') returning id into v_id;
  end if;
  insert into app.rahasia_tempat (tempat_id, perusahaan_id) values (v_id, v_pid) on conflict (tempat_id) do nothing;
  return v_id;
end $$;

-- Kode untuk layar kios: kode sekarang dan sisa detiknya. Pemilik/admin saja; rahasia tidak pernah keluar.
create or replace function public.kode_absen(p_tempat uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k bytea; u double precision := extract(epoch from clock_timestamp());
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then raise exception 'Khusus pemilik atau admin' using errcode = '42501'; end if;
  select r.rahasia into k from app.rahasia_tempat r join public.tempat t on t.id = r.tempat_id
   where r.tempat_id = p_tempat and r.perusahaan_id = v_pid and t.aktif;
  if k is null then raise exception 'Tempat tidak ditemukan' using errcode = 'P0002'; end if;
  return jsonb_build_object('kode', app.totp(k, u, 15, 6), 'langkah', floor(u / 15)::bigint, 'sisa_detik', ceil(15 - mod(u::numeric, 15))::int);
end $$;

-- Absen staf: kode QR sah (langkah sekarang atau sebelumnya), cek wajah di perangkat lolos, belum pernah dipakai orang ini.
create or replace function public.absen_catat(p_tempat uuid, p_kode text, p_jenis text, p_wajah jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_orang uuid; k bytea; u double precision := extract(epoch from clock_timestamp());
  t bigint := floor(u / 15)::bigint; v_langkah bigint; v_saat timestamptz := now();
begin
  if v_pid is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  if p_jenis not in ('absen.masuk', 'absen.pulang') then raise exception 'Jenis absen tidak dikenal' using errcode = '22023'; end if;
  select a.orang_id into v_orang from public.anggota a where a.perusahaan_id = v_pid and a.user_id = (select auth.uid()) and a.aktif;
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini. Minta pemilik membuatkan akun staf.' using errcode = '42501'; end if;
  if coalesce(p_wajah ->> 'lulus', 'false') <> 'true' then raise exception 'Cek wajah belum lolos. Coba lagi di tempat yang terang.' using errcode = '22023'; end if;
  select r.rahasia into k from app.rahasia_tempat r join public.tempat t2 on t2.id = r.tempat_id
   where r.tempat_id = p_tempat and r.perusahaan_id = v_pid and t2.aktif;
  if k is null then raise exception 'Kode QR ini bukan untuk usahamu.' using errcode = 'P0002'; end if;
  if p_kode = app.totp(k, t * 15, 15, 6) then v_langkah := t;
  elsif p_kode = app.totp(k, (t - 1) * 15, 15, 6) then v_langkah := t - 1;
  else raise exception 'Kode QR sudah kedaluwarsa. Pindai ulang kode di layar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kejadian e where e.perusahaan_id = v_pid and e.orang_id = v_orang and e.jenis = p_jenis
               and e.terjadi_at > v_saat - interval '2 minutes' and (e.data ->> 'langkah')::bigint = v_langkah) then
    raise exception 'Kode ini sudah kamu pakai. Tunggu kode berikutnya bila perlu absen lagi.' using errcode = 'P0001';
  end if;
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, tempat_id, data)
  values (v_pid, v_saat, p_jenis, 'pwa', v_orang, p_tempat, jsonb_build_object('langkah', v_langkah,
    'wajah', jsonb_build_object('kedip', coalesce((p_wajah ->> 'kedip')::boolean, false), 'menoleh', coalesce(p_wajah ->> 'menoleh', ''))));
  return jsonb_build_object('jenis', p_jenis, 'saat', v_saat);
end $$;

revoke all on function public.tempat_absen_utama(), public.kode_absen(uuid), public.absen_catat(uuid, text, text, jsonb) from public, anon;
grant execute on function public.tempat_absen_utama(), public.kode_absen(uuid), public.absen_catat(uuid, text, text, jsonb) to authenticated;
