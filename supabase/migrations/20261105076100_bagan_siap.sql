-- M-08: usaha baru belum punya bagan akun sampai jurnal pertama dibukukan, sehingga pilihan akun di halaman anggaran dan
-- jurnal berulang kosong. Halaman memanggil ensure_chart() bila bagan belum ada (pemilik, admin, atau akuntan).
create or replace function public.ensure_chart() returns int
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_buku();
begin
  if exists (select 1 from public.akun where perusahaan_id = v_pid) then return 0; end if;
  perform app.pasang_bagan_bawaan(v_pid);
  return 1;
end $$;
revoke all on function public.ensure_chart() from public, anon;
grant execute on function public.ensure_chart() to authenticated;
