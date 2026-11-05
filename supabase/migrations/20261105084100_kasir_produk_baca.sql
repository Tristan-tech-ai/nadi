-- M-19 perbaikan (ditemukan e2e M-21): pos_products STABLE memanggil app.gudang_utama yang membuat gudang bila belum ada, sehingga
-- gagal "cannot execute INSERT in a read-only transaction" di usaha tanpa gudang. Kini hanya membaca gudang utama yang sudah ada.
create or replace function public.pos_products() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_kasir(); v_g uuid := (select g.id from public.gudang g where g.perusahaan_id = v_pid and g.utama limit 1);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kode', p.kode, 'nama', p.nama, 'harga', p.harga_jual, 'satuan', p.satuan, 'barcode', p.barcode,
           'jenis', p.jenis, 'stok', (select s.jumlah from public.stok s where s.produk_id = p.id and s.gudang_id = v_g)) order by p.nama)
    from public.produk p where p.perusahaan_id = v_pid and p.aktif and p.harga_jual > 0), '[]');
end $$;
