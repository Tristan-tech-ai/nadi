-- Q-13 (docs/quality/keamanan-f0.md S6, S7, A7, A8): penguncian percobaan kode absen dan PIN staf, sinyal cek wajah sebagai sinyal lunak.
-- Hook verifikasi sandi Supabase hanya untuk paket Teams/Enterprise (docs auth-hooks, 31 Okt 2026), jadi PIN salah dicatat oleh server
-- action masuk staf lewat pin_staf_gagal, dan penguncian memakai auth.users.banned_until (GoTrue menolak dengan kode user_banned).

create table app.percobaan (
  id bigint generated always as identity primary key,
  jenis text not null check (jenis in ('absen.kode', 'pin')),
  kunci text not null,
  saat timestamptz not null default clock_timestamp()
);
create index on app.percobaan (jenis, kunci, saat desc);
revoke all on app.percobaan from public, anon, authenticated;

create or replace function public.absen_catat(p_tempat uuid, p_kode text, p_jenis text, p_wajah jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := app.pid(); v_orang uuid; k bytea; u double precision := extract(epoch from clock_timestamp());
  t bigint := floor(u / 15)::bigint; v_langkah bigint; v_saat timestamptz := now(); v_salah int; v_salah2 int;
begin
  if v_pid is null then raise exception 'Masuk dulu ke usahamu' using errcode = '28000'; end if;
  if p_jenis not in ('absen.masuk', 'absen.pulang') then raise exception 'Jenis absen tidak dikenal' using errcode = '22023'; end if;
  select a.orang_id into v_orang from public.anggota a where a.perusahaan_id = v_pid and a.user_id = (select auth.uid()) and a.aktif;
  if v_orang is null then raise exception 'Akunmu belum terhubung ke data orang di usaha ini. Minta pemilik membuatkan akun staf.' using errcode = '42501'; end if;
  if coalesce(p_wajah ->> 'lulus', 'false') <> 'true' then raise exception 'Cek wajah belum lolos. Coba lagi di tempat yang terang.' using errcode = '22023'; end if;
  select r.rahasia into k from app.rahasia_tempat r join public.tempat t2 on t2.id = r.tempat_id
   where r.tempat_id = p_tempat and r.perusahaan_id = v_pid and t2.aktif;
  if k is null then raise exception 'Kode QR ini bukan untuk usahamu.' using errcode = 'P0002'; end if;
  -- Q-13: paling banyak 5 kode salah per orang per menit (kode 6 angka berlaku 15-30 detik).
  select count(*) filter (where saat > clock_timestamp() - interval '1 minute'), count(*) into v_salah, v_salah2
    from app.percobaan where jenis = 'absen.kode' and kunci = v_orang::text and saat > clock_timestamp() - interval '2 minutes';
  if v_salah >= 5 then raise exception 'Terlalu banyak kode salah. Tunggu satu menit, lalu pindai ulang kode di layar.' using errcode = '54000'; end if;
  if p_kode = app.totp(k, t * 15, 15, 6) then v_langkah := t;
  elsif p_kode = app.totp(k, (t - 1) * 15, 15, 6) then v_langkah := t - 1;
  else
    -- Dicatat lalu dikembalikan sebagai galat (bukan exception) agar catatan percobaan tidak ikut dibatalkan.
    insert into app.percobaan (jenis, kunci) values ('absen.kode', v_orang::text);
    return jsonb_build_object('galat', 'Kode QR sudah kedaluwarsa. Pindai ulang kode di layar.');
  end if;
  if exists (select 1 from public.kejadian e where e.perusahaan_id = v_pid and e.orang_id = v_orang and e.jenis = p_jenis
               and e.terjadi_at > v_saat - interval '2 minutes' and (e.data ->> 'langkah')::bigint = v_langkah) then
    raise exception 'Kode ini sudah kamu pakai. Tunggu kode berikutnya bila perlu absen lagi.' using errcode = 'P0001';
  end if;
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, tempat_id, data)
  values (v_pid, v_saat, p_jenis, 'pwa', v_orang, p_tempat, jsonb_build_object('langkah', v_langkah,
    'salah_sebelum', v_salah2,
    'wajah', jsonb_build_object('lulus', true, 'kedip', coalesce((p_wajah ->> 'kedip')::boolean, false), 'menoleh', coalesce(p_wajah ->> 'menoleh', ''))));
  return jsonb_build_object('jenis', p_jenis, 'saat', v_saat);
end $$;

-- PIN staf salah: hanya akun staf sintetis ({kode}-S###@staf.nadi.local); 5 kali dalam 15 menit (sejak atur ulang PIN terakhir) = terkunci 15 menit.
-- Paling banyak 5 baris per akun per jendela, jadi pemanggilan berulang tidak membengkakkan tabel.
create or replace function public.pin_staf_gagal(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_sejak timestamptz; n int;
begin
  if p_email is null or lower(p_email) !~ '^[a-z0-9]{6}-s[0-9]{3}@staf\.nadi\.local$' then
    return jsonb_build_object('terkunci', false);
  end if;
  select id, greatest(clock_timestamp() - interval '15 minutes', updated_at) into v_user, v_sejak
    from auth.users where email = lower(p_email) and raw_user_meta_data ->> 'staf' = 'true';
  if v_user is null then return jsonb_build_object('terkunci', false); end if;
  select count(*) into n from app.percobaan where jenis = 'pin' and kunci = v_user::text and saat > v_sejak;
  if n < 5 then
    insert into app.percobaan (jenis, kunci) values ('pin', v_user::text);
    n := n + 1;
  end if;
  if n >= 5 then
    update auth.users set banned_until = now() + interval '15 minutes' where id = v_user;
    return jsonb_build_object('terkunci', true);
  end if;
  return jsonb_build_object('terkunci', false, 'sisa', 5 - n);
end $$;
revoke all on function public.pin_staf_gagal(text) from public;
grant execute on function public.pin_staf_gagal(text) to anon, authenticated;

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
    -- Q-13: atur ulang PIN juga membuka kunci dan memulai hitungan PIN salah dari nol (dihitung sejak updated_at).
    update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), banned_until = null, updated_at = now() where id = o.user_id;
  end if;
  return jsonb_build_object('kode', v_kode, 'id_staf', o.id_staf);
end $$;

-- Absen yang patut dicek pemilik: cek gerak wajah tidak lengkap atau banyak kode salah sebelum berhasil (sinyal lunak, bukan vonis).
create or replace function public.absen_ragu(p_hari integer default 30)
returns table (kejadian_id uuid, orang_id uuid, nama text, terjadi_at timestamptz, jenis text, alasan text)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.orang_id, o.nama, e.terjadi_at, e.jenis,
         concat_ws('; ',
           case when coalesce(e.data -> 'wajah' ->> 'kedip', 'false') <> 'true' then 'tidak terdeteksi berkedip' end,
           case when coalesce(e.data -> 'wajah' ->> 'menoleh', '') = '' then 'tidak terdeteksi menoleh' end,
           case when coalesce((e.data ->> 'salah_sebelum')::int, 0) >= 3 then (e.data ->> 'salah_sebelum') || ' kode salah sebelum berhasil' end)
    from public.kejadian e join public.orang o on o.id = e.orang_id
   where e.perusahaan_id = (select app.pid()) and e.jenis in ('absen.masuk', 'absen.pulang')
     and e.terjadi_at > now() - make_interval(days => least(greatest(coalesce(p_hari, 30), 1), 90))
     and (coalesce(e.data -> 'wajah' ->> 'kedip', 'false') <> 'true' or coalesce(e.data -> 'wajah' ->> 'menoleh', '') = ''
          or coalesce((e.data ->> 'salah_sebelum')::int, 0) >= 3)
   order by e.terjadi_at desc
   limit 200
$$;
revoke all on function public.absen_ragu(integer) from public, anon;
grant execute on function public.absen_ragu(integer) to authenticated;
