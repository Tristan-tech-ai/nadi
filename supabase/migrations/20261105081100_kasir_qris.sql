-- M-19: QRIS statis usaha untuk layar kasir. Staf tidak boleh membaca public.bayar_usaha (rekening, pemilik/admin/akuntan),
-- jadi kasir mendapat hanya isi QRIS dan nama merchant lewat RPC anggota aktif.
create or replace function public.pos_payment_qr() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir();
begin
  return (select jsonb_build_object('qris', b.qris, 'nama', b.qris_nama) from public.bayar_usaha b where b.perusahaan_id = v_pid and b.qris is not null);
end $$;
revoke all on function public.pos_payment_qr() from public, anon;
grant execute on function public.pos_payment_qr() to authenticated;
