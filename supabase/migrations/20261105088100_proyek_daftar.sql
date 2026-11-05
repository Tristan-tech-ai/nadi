-- W-07D: daftar proyek aktif (id, nama) untuk semua anggota aktif agar staf bisa mencatat jam kerja; tabel dimensi tetap khusus pengelola.
create or replace function public.active_projects() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nama', d.nama) order by d.nama), '[]')
    from public.dimension d where d.perusahaan_id = app.pid() and d.jenis = 'proyek' and d.aktif and (select app.anggota_aktif())
$$;
revoke all on function public.active_projects() from public, anon;
grant execute on function public.active_projects() to authenticated;
