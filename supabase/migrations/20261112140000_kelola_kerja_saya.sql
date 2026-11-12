-- X-13B: koordinator kerja (staf atau akuntan dengan peran kustom kerja.kelola) membuat dan mengatur kerja dari layar Kerja.
-- buat_kerja dan atur_pelaksana_kerja sudah menerima kerja.kelola (X-13); yang belum ada adalah cara layar mengetahui izin itu
-- dan daftar rekan untuk dipilih, karena RLS orang membatasi staf ke dirinya sendiri. Fungsi ini hanya mengembalikan id dan nama
-- orang aktif serta id dan nama topi aktif usaha ini, dan hanya bila pemanggil boleh mengelola kerja; tanpa gaji, rekening, atau
-- data orang lain.
create function public.kelola_kerja_saya() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when app.pid() is not null and app.anggota_aktif() and app.izin('kerja.kelola') then jsonb_build_object(
      'kelola', true,
      'orang', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nama', o.nama) order by o.nama)
                           from public.orang o where o.perusahaan_id = app.pid() and o.status = 'aktif'), '[]'::jsonb),
      'topi', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nama', t.nama) order by t.nama)
                          from public.topi t where t.perusahaan_id = app.pid() and t.aktif), '[]'::jsonb))
    else jsonb_build_object('kelola', false, 'orang', '[]'::jsonb, 'topi', '[]'::jsonb)
  end
$$;
revoke all on function public.kelola_kerja_saya() from public, anon;
grant execute on function public.kelola_kerja_saya() to authenticated;
