-- Q-01 tinjauan keamanan: perbaikan temuan TINGGI (docs/quality/keamanan-f0.md).
-- T1 ambil alih akun lewat orang.user_id + buat_akun_staf; T2 admin menurunkan pemilik / admin yang dicabut memulihkan diri;
-- T3 unggah tanpa batas (storage + biaya AI); S1/S2 berkas dan usulan lintas usaha.

-- T1a: orang.user_id hanya diisi fungsi server (buat_akun_staf), tidak pernah oleh klien.
create or replace function app.jaga_orang_user() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id end) then
    raise exception 'Akun orang hanya bisa ditautkan lewat pembuatan akun staf' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger orang_jaga_user before insert or update of user_id on public.orang
  for each row execute function app.jaga_orang_user();

-- T1b: ganti PIN hanya untuk akun staf sintetis buatan Nadi, bukan akun email sungguhan.
create or replace function public.buat_akun_staf(p_orang uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orang;
  v_kode text;
  v_email text;
  v_user uuid;
begin
  if not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa membuat akun staf' using errcode = '42501';
  end if;
  if p_pin !~ '^\d{6}$' then
    raise exception 'PIN harus 6 angka' using errcode = '22023';
  end if;
  select * into o from public.orang where id = p_orang and perusahaan_id = app.pid();
  if o.id is null then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = '42501';
  end if;
  select kode into v_kode from public.perusahaan where id = o.perusahaan_id;
  if o.id_staf is null then
    select 'S' || lpad((count(*) + 1)::text, 3, '0') into o.id_staf from public.orang where perusahaan_id = o.perusahaan_id and id_staf is not null;
    update public.orang set id_staf = o.id_staf where id = o.id;
  end if;
  v_email := lower(v_kode || '-' || o.id_staf || '@staf.nadi.local');

  if o.user_id is null then
    v_user := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
            extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'pid', o.perusahaan_id, 'prn', 'staf'),
            jsonb_build_object('staf', true), now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user::text, v_user, jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
    update public.orang set user_id = v_user where id = o.id;
    insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (o.perusahaan_id, v_user, 'staf', o.id)
      on conflict (perusahaan_id, user_id) do update set aktif = true, orang_id = excluded.orang_id;
  else
    -- Akun sudah ada: ganti PIN hanya bila itu akun staf sintetis untuk orang ini (email {kode}-{id}@staf.nadi.local).
    if not exists (select 1 from auth.users u where u.id = o.user_id and u.email = v_email and u.raw_user_meta_data ->> 'staf' = 'true') then
      raise exception 'Orang ini memakai akun sendiri; PIN hanya bisa diatur untuk akun staf buatan Nadi' using errcode = '42501';
    end if;
    update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = o.user_id;
  end if;
  return jsonb_build_object('kode', v_kode, 'id_staf', o.id_staf);
end $$;
revoke all on function public.buat_akun_staf(uuid, text) from public, anon;
grant execute on function public.buat_akun_staf(uuid, text) to authenticated;

-- T2: kelola anggota butuh keanggotaan aktif sungguhan (bukan klaim JWT saja), tidak menyentuh baris pemilik atau diri sendiri,
-- orang_id harus milik usaha yang sama, dan mengubah peran hanya oleh pemilik.
drop policy anggota_kelola on public.anggota;
create policy anggota_kelola on public.anggota for update to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif(array['pemilik', 'admin']))
         and peran <> 'pemilik' and user_id <> (select auth.uid()))
  with check (perusahaan_id = (select app.pid()) and peran <> 'pemilik'
              and (orang_id is null or exists (select 1 from public.orang o where o.id = orang_id and o.perusahaan_id = (select app.pid()))));

create or replace function app.jaga_peran_anggota() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.peran is distinct from old.peran and not app.anggota_aktif(array['pemilik']) then
    raise exception 'Hanya pemilik yang bisa mengubah peran anggota' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger anggota_jaga_peran before update of peran on public.anggota
  for each row execute function app.jaga_peran_anggota();

-- S1: jalur berkas selalu di folder usahanya sendiri (baca-berkas mengunduh lewat jalur ini dengan kunci server).
alter table public.berkas add constraint berkas_jalur_usaha check (split_part(jalur, '/', 1) = perusahaan_id::text);

-- S2: usulan hanya boleh menunjuk berkas usaha yang sama (putuskan_usulan memperbarui berkas lewat berkas_id).
create or replace function app.jaga_berkas_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.berkas_id is not null and not exists (select 1 from public.berkas b where b.id = new.berkas_id and b.perusahaan_id = new.perusahaan_id) then
    raise exception 'Berkas bukan milik usaha ini' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function app.jaga_berkas_usulan() from public, anon, authenticated;
create trigger usulan_jaga_berkas before insert or update of berkas_id on public.usulan
  for each row execute function app.jaga_berkas_usulan();

-- T3: batas unggah harian (hari WITA) per usaha, seluruh platform, dan khusus lamaran tanpa akun. Angka di public.konfigurasi
-- (kunci batas_berkas) agar bisa dinaikkan tanpa migrasi. Bawaan disetel untuk paket Free (storage 1 GB).
insert into public.konfigurasi (kunci, nilai, catatan) values ('batas_berkas',
  '{"usaha_berkas": 200, "usaha_mb": 200, "platform_berkas": 2000, "platform_mb": 600, "lamar_platform": 300}',
  'Batas unggah per hari WITA (Q-01). usaha_*: per usaha; platform_*: semua usaha; lamar_platform: lamaran tanpa akun.')
on conflict (kunci) do nothing;
create index if not exists berkas_dibuat_at_idx on public.berkas (dibuat_at);

create or replace function app.batas_berkas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b jsonb := coalesce((select nilai from public.konfigurasi where kunci = 'batas_berkas'), '{}');
  v_awal timestamptz := date_trunc('day', now() at time zone 'Asia/Makassar') at time zone 'Asia/Makassar';
  v_n bigint; v_mb numeric;
begin
  select count(*), coalesce(sum(ukuran), 0) / 1048576.0 into v_n, v_mb from public.berkas where perusahaan_id = new.perusahaan_id and dibuat_at >= v_awal;
  if v_n >= coalesce((b ->> 'usaha_berkas')::int, 200) or v_mb + coalesce(new.ukuran, 0) / 1048576.0 > coalesce((b ->> 'usaha_mb')::numeric, 200) then
    raise exception 'Batas unggah harian usaha ini tercapai. Coba lagi besok.' using errcode = '54000';
  end if;
  select count(*), coalesce(sum(ukuran), 0) / 1048576.0 into v_n, v_mb from public.berkas where dibuat_at >= v_awal;
  if v_n >= coalesce((b ->> 'platform_berkas')::int, 2000) or v_mb + coalesce(new.ukuran, 0) / 1048576.0 > coalesce((b ->> 'platform_mb')::numeric, 600) then
    raise exception 'Nadi sedang menerima terlalu banyak berkas hari ini. Coba lagi besok.' using errcode = '54000';
  end if;
  if split_part(new.jalur, '/', 2) = 'lamar' then
    select count(*) into v_n from public.berkas where dibuat_at >= v_awal and split_part(jalur, '/', 2) = 'lamar';
    if v_n >= coalesce((b ->> 'lamar_platform')::int, 300) then
      raise exception 'Lamaran sedang ramai hari ini. Coba lagi besok.' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.batas_berkas() from public, anon, authenticated;
create trigger berkas_batas before insert on public.berkas
  for each row execute function app.batas_berkas();
