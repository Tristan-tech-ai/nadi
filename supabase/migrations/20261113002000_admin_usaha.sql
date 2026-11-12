-- ADMIN-01: pemilik menjadikan akun Nadi lain admin usahanya dan mencabutnya lagi, dari layar Orang. Polanya sama dengan
-- tambah_akuntan (20261101031100_undang_akuntan.sql): hanya pemilik (app.peran_aktif dari tabel anggota, bukan klaim JWT),
-- lewat email akun Nadi yang sudah ada, jawaban sama untuk email terdaftar atau tidak (tidak membocorkan siapa yang punya akun),
-- akun staf tanpa email ditolak, baris pemilik tidak pernah diturunkan, mencabut berarti menonaktifkan (tidak menghapus).
-- Nama baru berbahasa Inggris (I-04).

create or replace function public.add_admin(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_user uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang menambahkan admin' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_email like '%@staf.nadi.local' then
    raise exception 'Tulis email akun Nadi milik calon admin.' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is not null and v_user <> auth.uid() then
    insert into public.anggota (perusahaan_id, user_id, peran, aktif) values (v_pid, v_user, 'admin', true)
    on conflict (perusahaan_id, user_id) do update set peran = 'admin', aktif = true where public.anggota.peran <> 'pemilik';
  end if;
  return 'Bila email itu sudah punya akun Nadi, ia kini admin usaha ini dan melihatnya setelah masuk lagi. Bila belum, minta ia mendaftar dulu lalu tambahkan lagi.';
end $$;

create or replace function public.list_admins() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat daftar admin' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'aktif', a.aktif, 'sejak', a.dibuat_at) order by a.aktif desc, u.email)
                     from public.anggota a join auth.users u on u.id = a.user_id
                    where a.perusahaan_id = v_pid and a.peran = 'admin'), '[]'::jsonb);
end $$;

create or replace function public.remove_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang mencabut admin' using errcode = '42501';
  end if;
  update public.anggota set aktif = false where perusahaan_id = v_pid and user_id = p_user and peran = 'admin' and aktif;
  if not found then raise exception 'Admin aktif tidak ditemukan' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.add_admin(text), public.list_admins(), public.remove_admin(uuid) from public, anon;
grant execute on function public.add_admin(text), public.list_admins(), public.remove_admin(uuid) to authenticated;
