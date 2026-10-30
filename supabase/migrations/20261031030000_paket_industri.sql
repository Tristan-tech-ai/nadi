-- Bank Publik: paket industri F&B dan toko (topi bawaan, jenis tempat, KPI, resep Mata), dipasang ke perusahaan aktif.
insert into public.paket_industri (kode, nama, versi, isi) values
('fnb', 'Warung, kafe, restoran', 1, '{
  "topi": [
    {"kode": "kasir", "nama": "Kasir", "tanggung_jawab": ["Menerima pembayaran", "Menutup kas harian"], "keahlian": ["Hitung uang", "Melayani pelanggan"], "kpi": [{"kode": "selisih_kas", "nama": "Selisih kas", "arah": "turun"}]},
    {"kode": "pelayan", "nama": "Pelayan", "tanggung_jawab": ["Menyambut tamu", "Mencatat pesanan", "Membersihkan meja"], "keahlian": ["Melayani pelanggan"], "kpi": [{"kode": "meja_kotor_menit", "nama": "Lama meja kotor", "arah": "turun"}]},
    {"kode": "koki", "nama": "Koki", "tanggung_jawab": ["Memasak pesanan", "Menjaga kebersihan dapur"], "keahlian": ["Memasak", "Keamanan pangan"], "kpi": [{"kode": "waktu_saji", "nama": "Waktu saji", "arah": "turun"}]},
    {"kode": "barista", "nama": "Barista", "tanggung_jawab": ["Membuat minuman"], "keahlian": ["Espresso", "Latte art"], "kpi": [{"kode": "waktu_saji", "nama": "Waktu saji", "arah": "turun"}]},
    {"kode": "gudang", "nama": "Gudang dan belanja", "tanggung_jawab": ["Menerima barang pemasok", "Hitung stok"], "keahlian": ["Stok opname"], "kpi": [{"kode": "stok_habis", "nama": "Kejadian stok habis", "arah": "turun"}]}
  ],
  "tempat": ["lokasi", "dapur", "meja", "kasir", "gudang"],
  "resep_mata": ["meja", "antrean_kasir"]
}'),
('toko', 'Toko, grosir, minimarket', 1, '{
  "topi": [
    {"kode": "kasir", "nama": "Kasir", "tanggung_jawab": ["Menerima pembayaran", "Menutup kas harian"], "keahlian": ["Hitung uang", "Melayani pelanggan"], "kpi": [{"kode": "selisih_kas", "nama": "Selisih kas", "arah": "turun"}]},
    {"kode": "pramuniaga", "nama": "Pramuniaga", "tanggung_jawab": ["Menata rak", "Membantu pembeli"], "keahlian": ["Melayani pelanggan", "Menata barang"], "kpi": [{"kode": "rak_kosong", "nama": "Rak kosong", "arah": "turun"}]},
    {"kode": "gudang", "nama": "Gudang", "tanggung_jawab": ["Menerima barang", "Stok opname"], "keahlian": ["Stok opname"], "kpi": [{"kode": "selisih_stok", "nama": "Selisih stok", "arah": "turun"}]},
    {"kode": "sales", "nama": "Sales kanvas", "tanggung_jawab": ["Mengantar pesanan", "Menagih"], "keahlian": ["Negosiasi"], "kpi": [{"kode": "tagihan_tertagih", "nama": "Tagihan tertagih", "arah": "naik"}]}
  ],
  "tempat": ["lokasi", "rak", "kasir", "gudang"],
  "resep_mata": ["rak", "antrean_kasir", "pengunjung"]
}')
on conflict (kode) do update set nama = excluded.nama, versi = excluded.versi, isi = excluded.isi;

-- Menyalin topi paket ke perusahaan aktif (idempoten: topi yang sudah ada dilewati). Hanya pemilik/admin.
create or replace function public.pasang_paket(p_kode text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_isi jsonb; n integer;
begin
  if not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang bisa memasang paket' using errcode = '42501';
  end if;
  select isi into v_isi from public.paket_industri where kode = p_kode;
  if v_isi is null then return 0; end if;
  insert into public.topi (perusahaan_id, kode, nama, tanggung_jawab, keahlian, kpi, asal_paket)
  select app.pid(), t ->> 'kode', t ->> 'nama', coalesce(t -> 'tanggung_jawab', '[]'), coalesce(t -> 'keahlian', '[]'), coalesce(t -> 'kpi', '[]'), p_kode
    from jsonb_array_elements(v_isi -> 'topi') t
  on conflict (perusahaan_id, kode) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.pasang_paket(text) from public, anon;
grant execute on function public.pasang_paket(text) to authenticated;
