-- Akun staf tanpa email: staf masuk dengan kode usaha + ID staf + PIN 6 digit.
-- Pemilik/admin membuat (atau mengganti PIN) akun staf untuk orang di perusahaannya. Akun auth memakai email sintetis
-- {kode}-{id}@staf.nadi.local yang tidak pernah menerima surat. Pola sama dengan akun uji e2e yang sudah terbukti bisa masuk.

create or replace function app.kode_acak(p_panjang integer) returns text
language sql volatile set search_path = '' as $$
  -- Tanpa huruf/angka yang mirip (0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, p_panjang);
$$;

alter table public.perusahaan add column kode text;
update public.perusahaan set kode = app.kode_acak(6) where kode is null;
alter table public.perusahaan alter column kode set default app.kode_acak(6);
alter table public.perusahaan alter column kode set not null;
create unique index perusahaan_kode_unik on public.perusahaan (kode);

alter table public.orang add column id_staf text;
create unique index orang_id_staf_unik on public.orang (perusahaan_id, id_staf) where id_staf is not null;

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
    -- Akun sudah ada: ganti PIN saja.
    update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = o.user_id;
  end if;
  return jsonb_build_object('kode', v_kode, 'id_staf', o.id_staf);
end $$;
revoke all on function public.buat_akun_staf(uuid, text) from public, anon;
grant execute on function public.buat_akun_staf(uuid, text) to authenticated;
grant execute on function app.kode_acak(integer) to authenticated;
