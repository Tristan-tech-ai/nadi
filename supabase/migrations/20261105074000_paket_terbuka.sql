-- W-06 paket industri terbuka: tiga paket baru (produksi rumahan, pertanian/peternakan/perikanan, pendidikan/kursus) dan
-- topi baru dari cerita pemilik sebagai usulan. Pemetaan cerita ke paket dan topi dilakukan aturan di server Next
-- (src/lib/paket/cocok.ts, tanpa model); database memeriksa ulang bentuk topi, menyimpan cerita, membuat usulan
-- onboarding.topi untuk pemilik, dan memasang topi saat usulan disetujui. Tes: supabase/tests/paket_terbuka.test.sql.

insert into public.paket_industri (kode, nama, versi, isi) values
('produksi', 'Produksi rumahan dan pabrik kecil', 1, '{
  "topi": [
    {"kode": "operator_produksi", "nama": "Operator produksi", "tanggung_jawab": ["Menjalankan proses produksi harian", "Mencatat hasil dan bahan terpakai"], "keahlian": ["Keamanan kerja"], "kpi": [{"kode": "hasil_produksi", "nama": "Hasil produksi", "arah": "naik"}]},
    {"kode": "pengemas", "nama": "Pengemas", "tanggung_jawab": ["Mengemas produk", "Menempel label"], "keahlian": ["Rapi dan teliti"], "kpi": [{"kode": "kemasan_rusak", "nama": "Kemasan rusak", "arah": "turun"}]},
    {"kode": "gudang", "nama": "Gudang bahan", "tanggung_jawab": ["Menerima bahan baku", "Hitung stok"], "keahlian": ["Stok opname"], "kpi": [{"kode": "stok_habis", "nama": "Kejadian bahan habis", "arah": "turun"}]},
    {"kode": "sales", "nama": "Penjualan dan antar", "tanggung_jawab": ["Menerima pesanan", "Mengantar ke pembeli"], "keahlian": ["Negosiasi"], "kpi": [{"kode": "tagihan_tertagih", "nama": "Tagihan tertagih", "arah": "naik"}]}
  ],
  "tempat": ["lokasi", "dapur_produksi", "gudang"],
  "resep_mata": ["pintu"]
}'),
('pertanian', 'Pertanian, peternakan, perikanan', 1, '{
  "topi": [
    {"kode": "pekerja_lapangan", "nama": "Pekerja lapangan", "tanggung_jawab": ["Merawat kebun, kandang, atau kolam", "Mencatat pakan, pupuk, dan panen"], "keahlian": ["Perawatan harian"], "kpi": [{"kode": "hasil_panen", "nama": "Hasil panen", "arah": "naik"}]},
    {"kode": "gudang", "nama": "Gudang pakan dan hasil", "tanggung_jawab": ["Menerima pakan dan pupuk", "Menimbang hasil panen"], "keahlian": ["Stok opname"], "kpi": [{"kode": "selisih_stok", "nama": "Selisih stok", "arah": "turun"}]},
    {"kode": "sales", "nama": "Penjualan hasil", "tanggung_jawab": ["Menjual ke pengepul atau pasar", "Menagih"], "keahlian": ["Negosiasi"], "kpi": [{"kode": "tagihan_tertagih", "nama": "Tagihan tertagih", "arah": "naik"}]}
  ],
  "tempat": ["lokasi", "kebun_kandang_kolam", "gudang"],
  "resep_mata": []
}'),
('pendidikan', 'Kursus, bimbel, sekolah, penitipan anak', 1, '{
  "topi": [
    {"kode": "pengajar", "nama": "Pengajar", "tanggung_jawab": ["Mengajar sesuai jadwal", "Mencatat kehadiran dan kemajuan murid"], "keahlian": ["Mengajar"], "kpi": [{"kode": "kehadiran_murid", "nama": "Kehadiran murid", "arah": "naik"}]},
    {"kode": "admin", "nama": "Admin pendaftaran", "tanggung_jawab": ["Menerima pendaftaran", "Menagih biaya kursus"], "keahlian": ["Administrasi"], "kpi": [{"kode": "tagihan_tertagih", "nama": "Biaya tertagih", "arah": "naik"}]}
  ],
  "tempat": ["lokasi", "kelas"],
  "resep_mata": ["pintu"]
}')
on conflict (kode) do update set nama = excluded.nama, versi = excluded.versi, isi = excluded.isi;

-- Bentuk satu topi usulan: kode a-z_ 2..40, nama 1..60, tanggung jawab larik teks paling banyak 6 x 120 huruf.
create or replace function app.topi_usulan_sah(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'object' and coalesce(t ->> 'kode', '') ~ '^[a-z][a-z_]{1,39}$'
     and char_length(btrim(coalesce(t ->> 'nama', ''))) between 1 and 60
     and jsonb_typeof(coalesce(t -> 'tanggung_jawab', '[]')) = 'array' and jsonb_array_length(coalesce(t -> 'tanggung_jawab', '[]')) <= 6
     and not exists (select 1 from jsonb_array_elements(coalesce(t -> 'tanggung_jawab', '[]')) x
                      where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 120)
$$;

-- Simpan cerita usaha dan ajukan topi baru sebagai satu usulan untuk pemilik. Topi yang kodenya sudah ada di usaha dilewati.
create or replace function public.usul_topi_baru(p_cerita text, p_paket text, p_yakin numeric, p_topi jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); v_baru jsonb; v_id uuid; v_nama text;
begin
  if v_pid is null or not app.anggota_aktif(array['pemilik', 'admin']) then
    raise exception 'Hanya pemilik atau admin yang menyiapkan paket usaha.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_cerita, ''))) not between 10 and 1000 then
    raise exception 'Ceritakan usahamu 10 sampai 1.000 huruf.' using errcode = '22023';
  end if;
  if p_yakin is null or p_yakin not between 0 and 1 then
    raise exception 'Keyakinan 0 sampai 1.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_topi) <> 'array' or jsonb_array_length(p_topi) > 8 or exists (select 1 from jsonb_array_elements(p_topi) t where not app.topi_usulan_sah(t)) then
    raise exception 'Topi usulan paling banyak 8 dengan kode, nama, dan tanggung jawab yang sah.' using errcode = '22023';
  end if;
  update public.perusahaan set pengaturan = jsonb_set(pengaturan, '{cerita_usaha}',
    jsonb_build_object('teks', btrim(p_cerita), 'paket', p_paket, 'yakin', p_yakin, 'at', now())) where id = v_pid;
  select coalesce(jsonb_agg(t), '[]') into v_baru from jsonb_array_elements(p_topi) t
   where not exists (select 1 from public.topi x where x.perusahaan_id = v_pid and x.kode = t ->> 'kode');
  if jsonb_array_length(v_baru) = 0 then return null; end if;
  select string_agg(t ->> 'nama', ', ') into v_nama from jsonb_array_elements(v_baru) t;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, kunci_klien, untuk_peran)
  values (v_pid, 'pwa', 'onboarding.topi', left('Tambah topi: ' || v_nama, 140),
    left('Dibaca dari ceritamu tanpa AI (aturan kata kunci, yakin ' || round(p_yakin * 100) || '%). Setujui bila memang ada orang yang mengerjakan ini; ubah atau tambah topi nanti di Orang.', 1000),
    jsonb_build_object('jenis', 'onboarding', 'bidang', jsonb_build_object('topi', v_baru, 'paket', p_paket)),
    'topi-' || md5(v_pid::text || v_baru::text), array['pemilik'])
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Usulan disetujui: pasang topi (buatan usaha, asal_paket null). Topi yang sudah ada tidak ditimpa.
create or replace function app.topi_dari_usulan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.topi (perusahaan_id, kode, nama, tanggung_jawab, asal_paket)
  select new.perusahaan_id, t ->> 'kode', btrim(t ->> 'nama'), coalesce(t -> 'tanggung_jawab', '[]'), null
    from jsonb_array_elements(coalesce(new.payload -> 'bidang' -> 'topi', '[]')) t
   where app.topi_usulan_sah(t)
  on conflict (perusahaan_id, kode) do nothing;
  return new;
end $$;
create trigger topi_dari_usulan after update of status on public.usulan for each row
  when (new.aksi = 'onboarding.topi' and new.status = 'diterima' and old.status is distinct from 'diterima') execute function app.topi_dari_usulan();

revoke all on function app.topi_usulan_sah(jsonb), app.topi_dari_usulan() from public, anon, authenticated;
revoke all on function public.usul_topi_baru(text, text, numeric, jsonb) from public, anon;
grant execute on function public.usul_topi_baru(text, text, numeric, jsonb) to authenticated;
