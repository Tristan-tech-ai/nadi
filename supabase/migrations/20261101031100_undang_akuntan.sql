-- F4-08 lanjutan: pemilik menambahkan akuntan lepasan lewat email akun Nadi-nya, melihat daftarnya, dan mencabutnya (aktif =
-- false, tidak dihapus). Jawaban tambah_akuntan sama untuk email terdaftar atau tidak, supaya fungsi ini tidak bisa dipakai
-- menebak email pengguna. Akun staf sintetis tidak bisa dijadikan akuntan; keanggotaan pemilik/admin yang sudah ada tidak
-- diturunkan. Tes: supabase/tests/undang_akuntan.test.sql.

create or replace function public.tambah_akuntan(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_user uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang menambahkan akuntan' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_email like '%@staf.nadi.local' then
    raise exception 'Tulis email akun Nadi milik akuntanmu.' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is not null and v_user <> auth.uid() then
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (v_pid, v_user, 'akuntan', true)
    on conflict (perusahaan_id, user_id) do update set aktif = true where public.anggota.peran = 'akuntan';
  end if;
  return 'Bila email itu sudah punya akun Nadi, ia kini bisa membuka usaha ini dari Ruang Akuntan. Bila belum, minta ia mendaftar dulu lalu tambahkan lagi.';
end $$;

create or replace function public.daftar_akuntan() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat daftar akuntan' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'aktif', a.aktif, 'sejak', a.dibuat_at) order by a.aktif desc, u.email)
                     from public.anggota a join auth.users u on u.id = a.user_id
                    where a.perusahaan_id = v_pid and a.peran = 'akuntan'), '[]'::jsonb);
end $$;

create or replace function public.cabut_akuntan(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mencabut akuntan' using errcode = '42501';
  end if;
  update public.anggota set aktif = false where perusahaan_id = v_pid and user_id = p_user and peran = 'akuntan' and aktif;
  if not found then raise exception 'Akuntan aktif tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.tambah_akuntan(text), public.daftar_akuntan(), public.cabut_akuntan(uuid) from public, anon;
grant execute on function public.tambah_akuntan(text), public.daftar_akuntan(), public.cabut_akuntan(uuid) to authenticated;
