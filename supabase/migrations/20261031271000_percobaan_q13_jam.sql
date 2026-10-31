-- Q-13 lanjutan: penanda atur ulang PIN memakai jam yang sama dengan catatan percobaan (clock_timestamp), agar hitungan PIN salah
-- selalu mulai dari nol setelah atur ulang, juga bila keduanya terjadi dalam satu transaksi.
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
    update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), banned_until = null, updated_at = clock_timestamp() where id = o.user_id;
  end if;
  return jsonb_build_object('kode', v_kode, 'id_staf', o.id_staf);
end $$;
