-- Usaha demo (F0-12): dua usaha contoh berdata karangan (warung makan dan toko grosir) yang bisa dilihat siapa saja di /demo
-- tanpa daftar. Baca-saja: tidak punya anggota, jadi RLS biasa tidak membukanya; hanya RPC demo_lihat yang membacanya.
-- "Reset tiap malam": pg_cron menggeser semua waktu data demo ke hari ini (data tidak bisa diubah siapa pun, jadi tidak ada yang
-- perlu dihapus atau diisi ulang, dan kejadian tidak pernah melewati batas retensi partisi).

create or replace function app.isi_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare v_fnb uuid; v_toko uuid; o record; v_orang jsonb := '{}'::jsonb;
begin
  if exists (select 1 from public.perusahaan where pengaturan ->> 'demo' = 'fnb') then return; end if;

  insert into public.perusahaan (nama, bentuk_usaha, industri, zona_waktu, pengaturan)
  values ('Warung Makan Bu Ratna (contoh)', 'perorangan', 'fnb', 'Asia/Makassar', jsonb_build_object('demo', 'fnb', 'demo_jangkar', now()))
  returning id into v_fnb;
  insert into public.perusahaan (nama, bentuk_usaha, industri, zona_waktu, pengaturan)
  values ('Toko Grosir Sinar Jaya (contoh)', 'cv', 'toko', 'Asia/Makassar', jsonb_build_object('demo', 'toko', 'demo_jangkar', now()))
  returning id into v_toko;

  for o in select * from (values
    (v_fnb, 'Sari Wulandari', 'S001', 'Kasir'), (v_fnb, 'Made Arsana', 'S002', 'Juru masak'), (v_fnb, 'Komang Ayu', 'S003', 'Pelayan'),
    (v_fnb, 'Putu Gede', 'S004', 'Pelayan, antar pesanan'), (v_fnb, 'Nyoman Sudarta', 'S005', 'Cuci piring'),
    (v_toko, 'Budi Santoso', 'S001', 'Kasir, gudang'), (v_toko, 'Wayan Suryani', 'S002', 'Admin stok'), (v_toko, 'Agus Prabowo', 'S003', 'Sopir antar'),
    (v_toko, 'Dewi Lestari', 'S004', 'Kasir')
  ) as x(pid, nama, sid, jabatan) loop
    insert into public.orang (perusahaan_id, nama, id_staf, data) values (o.pid, o.nama, o.sid, jsonb_build_object('jabatan', o.jabatan, 'sumber', 'contoh'))
    returning jsonb_build_object(o.nama, id) || v_orang into v_orang;
  end loop;

  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, keyakinan, dampak_rp, tenggat, dibuat_at) values
    (v_fnb, 'lempar', 'uang.keluar', 'Catat belanja Rp1.289.000 di UD Sumber Rejeki', '6 barang, nota NT-5841. Dibaca dengan aturan tersimpan untuk tata letak ini, tanpa AI.',
      '{"bidang": {"pemasok": "UD Sumber Rejeki", "tanggal": "", "total": 1289000}}', 0.99, 1289000, null, now() - interval '35 minutes'),
    (v_fnb, 'lempar', 'izin.sakit', 'Catat izin sakit Komang Ayu 2 hari', 'Mulai hari ini. Dibaca dari surat dokter, yakin 94%.',
      '{"bidang": {"nama": "Komang Ayu", "lama_hari": 2}}', 0.94, null, now() + interval '6 hours', now() - interval '2 hours'),
    (v_fnb, 'lempar', 'rekrut.pelamar', 'Catat Kadek Rina sebagai pelamar pelayan', '2 pengalaman kerja. Dibaca dari berkas, yakin 91%.',
      '{"bidang": {"nama": "Kadek Rina", "posisi": "Pelayan"}}', 0.91, null, null, now() - interval '1 day'),
    (v_fnb, 'mcp', 'catatan', 'Catat stok minyak goreng tinggal 2 jeriken', 'Diajukan asisten AI pemilik dari obrolan pagi ini.',
      '{"bidang": {"isi": "Stok minyak goreng tinggal 2 jeriken, pesan ulang Kamis"}}', null, null, null, now() - interval '3 hours'),
    (v_toko, 'lempar', 'uang.tagihan', 'Catat tagihan INV/2026/10/0412 Rp8.750.000', 'PT Sumber Pangan Lestari ke Toko Grosir Sinar Jaya, jatuh tempo 7 hari lagi. Dibaca dari berkas, yakin 97%.',
      '{"bidang": {"penjual": "PT Sumber Pangan Lestari", "nomor": "INV/2026/10/0412", "total": 8750000}}', 0.97, 8750000, now() + interval '7 days', now() - interval '4 hours'),
    (v_toko, 'lempar', 'uang.mutasi', 'Cocokkan 18 transaksi rekening', 'Nadi akan mencocokkan dengan nota dan tagihan yang sudah tercatat. Dibaca dengan aturan tersimpan untuk tata letak ini, tanpa AI.',
      '{"bidang": {"baris": []}}', 0.99, null, null, now() - interval '1 day'),
    (v_toko, 'lempar', 'orang.buat', 'Tambah Rudi Hartono ke daftar orang', 'Dari KTP; NIK disimpan terpisah dan hanya terlihat pemilik/admin. Dibaca dari berkas, yakin 96%.',
      '{"bidang": {"nama": "RUDI HARTONO"}}', 0.96, null, null, now() - interval '5 hours');

  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, orang_id, nilai, data)
  select v_fnb, date_trunc('day', now()) - make_interval(days => h) + interval '7 hours' + make_interval(mins => m), 'absen.harian', 'pwa',
         (v_orang ->> n)::uuid, null, jsonb_build_object('nama', n, 'masuk', to_char(make_time(7, m, 0), 'HH24.MI'))
    from (values ('Sari Wulandari', 2), ('Made Arsana', 0), ('Komang Ayu', 14), ('Putu Gede', 5), ('Nyoman Sudarta', 21)) as a(n, m),
         generate_series(1, 6) h;
  insert into public.kejadian (perusahaan_id, terjadi_at, jenis, sumber, nilai, data)
  select pid, date_trunc('day', now()) - make_interval(days => h) + interval '9 hours', 'uang.keluar', 'lempar', nilai, jsonb_build_object('pemasok', pemasok)
    from (values (v_fnb, 1, 376500, 'UD Sumber Rejeki'), (v_fnb, 2, 1150000, 'Pasar Badung'), (v_fnb, 4, 640000, 'Toko Plastik Jaya'),
                 (v_fnb, 6, 982000, 'UD Sumber Rejeki'), (v_toko, 1, 12400000, 'PT Sumber Pangan Lestari'), (v_toko, 3, 5300000, 'CV Mitra Plastik'),
                 (v_toko, 5, 2150000, 'Distributor Minyak Bali')) as b(pid, h, nilai, pemasok);
end $$;
revoke all on function app.isi_demo() from public, anon, authenticated;
select app.isi_demo();

-- Geser semua waktu data demo agar selalu terlihat "hari ini". Hanya update, tidak menghapus.
create or replace function app.segarkan_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare p record; d interval;
begin
  for p in select id, (pengaturan ->> 'demo_jangkar')::timestamptz as jangkar from public.perusahaan where pengaturan ? 'demo' loop
    d := now() - p.jangkar;
    if d < interval '1 hour' then continue; end if;
    update public.usulan set dibuat_at = dibuat_at + d, tenggat = tenggat + d where perusahaan_id = p.id;
    update public.kejadian set terjadi_at = terjadi_at + d, dicatat_at = dicatat_at + d where perusahaan_id = p.id;
    update public.perusahaan set pengaturan = jsonb_set(pengaturan, '{demo_jangkar}', to_jsonb(now())) where id = p.id;
  end loop;
end $$;
revoke all on function app.segarkan_demo() from public, anon, authenticated;
select cron.schedule('nadi-demo-segar', '0 17 * * *', $$select app.segarkan_demo()$$); -- 01.00 WITA

-- Satu-satunya pintu baca ke usaha demo. Anon DISENGAJA: halaman /demo terbuka tanpa daftar; hanya usaha bertanda demo.
create or replace function public.demo_lihat(p_kunci text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.perusahaan where pengaturan ->> 'demo' = p_kunci and p_kunci in ('fnb', 'toko'))
  select case when not exists (select 1 from p) then null else jsonb_build_object(
    'usaha', (select jsonb_build_object('nama', nama, 'industri', industri, 'zona_waktu', zona_waktu) from p),
    'usulan', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'judul', u.judul, 'penjelasan', u.penjelasan, 'sumber', u.sumber,
                'keyakinan', u.keyakinan, 'dampak_rp', u.dampak_rp, 'tenggat', u.tenggat, 'dibuat_at', u.dibuat_at)
                order by u.tenggat nulls last, u.dampak_rp desc nulls last, u.dibuat_at desc)
              from public.usulan u where u.perusahaan_id = (select id from p) and u.status = 'menunggu'), '[]'::jsonb),
    'orang', coalesce((select jsonb_agg(jsonb_build_object('nama', o.nama, 'id_staf', o.id_staf, 'jabatan', o.data ->> 'jabatan') order by o.id_staf)
              from public.orang o where o.perusahaan_id = (select id from p)), '[]'::jsonb),
    'belanja_7_hari', (select coalesce(sum(k.nilai), 0) from public.kejadian k
              where k.perusahaan_id = (select id from p) and k.jenis = 'uang.keluar' and k.terjadi_at > now() - interval '7 days'),
    'absen_kemarin', (select count(*) from public.kejadian k
              where k.perusahaan_id = (select id from p) and k.jenis = 'absen.harian'
                and k.terjadi_at >= date_trunc('day', now()) - interval '1 day' and k.terjadi_at < date_trunc('day', now())))
  end
$$;
revoke all on function public.demo_lihat(text) from public;
grant execute on function public.demo_lihat(text) to anon, authenticated;
comment on function public.demo_lihat(text) is 'SECURITY DEFINER dan anon DISENGAJA: halaman demo publik baca-saja; hanya membaca usaha dengan pengaturan.demo fnb/toko.';
