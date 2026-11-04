-- Tes M-18: kategori + batas per bulan + struk wajib; klaim staf lewat atasan lalu pemilik; jurnal beban/2-160; dibayar lewat slip
-- (penggantian tidak menjadi dasar Pasal 65 dan dibatasi klaim disetujui) atau kas; perjalanan dinas dengan uang muka, klaim dipotong
-- uang muka, sisa uang muka menjadi kasbon; staf hanya data sendiri; isolasi usaha.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  pa uuid; pb uuid; ka text; kb text; k1 text; k2 text; k3 text; o1 uuid; o2 uuid; o3 uuid; hari date; bk uuid; kt1 uuid; kt2 uuid;
  r jsonb; g text; c1 uuid; c2 uuid; c3 uuid; c4 uuid; us uuid; d1 uuid; per uuid; lk uuid;
begin
  insert into auth.users (id, email) values (ua, 'kl-a@uji.local'), (ub, 'kl-b@uji.local'), (u1, 'kl-1@uji.local'), (u2, 'kl-2@uji.local'), (u3, 'kl-3@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Toko Klaim A', 'ritel');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Klaim B', 'ritel');
  execute 'reset role';
  hari := app.hari_ini(pa);
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Sales Klaim', array['karyawan'], u1) returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kepala Sales', array['karyawan'], u2) returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, user_id) values (pa, 'Kurir Lain', array['karyawan'], u3) returning id into o3;
  insert into public.anggota (perusahaan_id, user_id, peran, orang_id) values (pa, u1, 'staf', o1), (pa, u2, 'staf', o2), (pa, u3, 'staf', o3);
  insert into public.berkas (perusahaan_id, jalur) values (pa, pa::text || '/uji/struk-bensin.jpg') returning id into bk;
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  k1 := json_build_object('sub', u1, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k2 := json_build_object('sub', u2, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  k3 := json_build_object('sub', u3, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  kt1 := public.simpan_kategori_klaim(null, 'Bensin', 500000, '6-920', true, true);
  kt2 := public.simpan_kategori_klaim(null, 'Parkir', null, null, false, true);
  perform public.ubah_profil_kerja(o1, 'Sales', null, null, o2, 'pkwtt', null, 'perubahan', null, null);
  perform set_config('request.jwt.claims', k1, true);
  begin perform public.simpan_kategori_klaim(null, 'Staf', null, null, false, true); perform pg_temp.cek('staf tidak membuat kategori', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membuat kategori', true); end;
  begin perform public.ajukan_klaim(kt1, hari, 150000, 'Bensin kunjungan toko', null, null, md5('c0')::uuid); perform pg_temp.cek('bensin tanpa struk ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('bensin tanpa struk ditolak', true); end;
  begin perform public.ajukan_klaim(kt2, hari + 1, 5000, 'Parkir besok', null, null, md5('c00')::uuid); perform pg_temp.cek('tanggal masa depan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('tanggal masa depan ditolak', true); end;
  c1 := (public.ajukan_klaim(kt1, hari, 300000, 'Bensin kunjungan toko', bk, null, md5('c1')::uuid) ->> 'id')::uuid;
  begin perform public.ajukan_klaim(kt1, hari, 250000, 'Bensin lagi', bk, null, md5('c2x')::uuid); perform pg_temp.cek('melebihi batas bulan ditolak dengan sisa', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('melebihi batas bulan ditolak dengan sisa', g like '%sisa Rp200.000%', g); end;
  c2 := (public.ajukan_klaim(kt2, hari, 20000, 'Parkir mal', null, null, md5('c2')::uuid) ->> 'id')::uuid;
  perform pg_temp.cek('kunci sama tidak menggandakan', (public.ajukan_klaim(kt2, hari, 20000, 'Parkir mal', null, null, md5('c2')::uuid) ->> 'sudah')::boolean);
  perform pg_temp.cek('sisa batas untuk staf', (select terpakai = 300000 and batas = 500000 from public.sisa_batas_klaim(hari) where nama = 'Bensin'));
  execute 'reset role';
  us := (select usulan_id from public.klaim where id = c1);
  perform pg_temp.cek('klaim staf beratasan menunggu atasan', (select status = 'menunggu_atasan' from public.usulan where id = us));
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', k2, true);
  perform public.putuskan_langkah((select id from public.langkah_saya() where judul like '%Bensin%'), true, null);
  lk := (select id from public.langkah_saya() where judul like '%Parkir%');
  perform public.putuskan_langkah(lk, false, 'Parkir pribadi');
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('ditolak atasan: klaim ditolak', (select status from public.klaim where id = c2) = 'ditolak');
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan(us, true);
  perform pg_temp.cek('disetujui pemilik: status disetujui', (select status from public.klaim where id = c1) = 'disetujui');
  perform pg_temp.cek('jurnal D 6-920 / K 2-160', (select sum(b.debit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '6-920') = 300000
    and (select sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '2-160') = 300000);

  -- Dibayar lewat slip: penggantian tidak menjadi dasar Pasal 65 dan tidak boleh melebihi klaim disetujui.
  execute 'reset role';
  insert into public.periode_gaji (perusahaan_id, bulan) values (pa, '2027-07-01') returning id into per;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values (o1, pa, '{"pokok": 1000000}');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  begin
    perform public.simpan_slip(per, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 1000000}, {"kode": "penggantian", "label": "Penggantian biaya", "jenis": "pendapatan", "nilai": 400000}]');
    perform pg_temp.cek('penggantian di atas klaim disetujui ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('penggantian di atas klaim disetujui ditolak', g like '%klaim disetujui%', g); end;
  begin
    perform public.simpan_slip(per, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 1000000}, {"kode": "penggantian", "label": "Penggantian biaya", "jenis": "pendapatan", "nilai": 300000}, {"kode": "denda", "label": "Denda", "jenis": "potongan", "nilai": 600000}]');
    perform pg_temp.cek('penggantian tidak menaikkan dasar Pasal 65', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('penggantian tidak menaikkan dasar Pasal 65', g like '%Pasal 65%', g); end;
  perform public.simpan_slip(per, o1, '[{"kode": "pokok", "label": "Gaji pokok", "jenis": "pendapatan", "nilai": 1000000}, {"kode": "penggantian", "label": "Penggantian biaya", "jenis": "pendapatan", "nilai": 300000}]');
  perform public.setujui_periode_gaji(per);
  perform pg_temp.cek('periode disetujui: klaim dibayar lewat slip', (select status = 'dibayar' and terbayar = 300000 and periode_id = per from public.klaim where id = c1));
  perform pg_temp.cek('saldo 2-160 nol setelah dibayar', (select sum(b.kredit) - sum(b.debit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '2-160') = 0);

  -- Bayar dari kas (pemilik saja).
  perform set_config('request.jwt.claims', k3, true);
  c3 := (public.ajukan_klaim(kt2, hari, 15000, 'Parkir kirim barang', null, null, md5('c3')::uuid) ->> 'id')::uuid;
  perform set_config('request.jwt.claims', ka, true);
  perform pg_temp.cek('tanpa atasan: langsung ke Feed pemilik', (select u.status = 'menunggu' from public.usulan u join public.klaim c on c.usulan_id = u.id where c.id = c3));
  perform public.putuskan_usulan((select usulan_id from public.klaim where id = c3), true);
  r := public.bayar_klaim(c3, 'kas');
  perform pg_temp.cek('bayar kas: dibayar, jurnal K 1-100', (select status from public.klaim where id = c3) = 'dibayar' and (r ->> 'dibayar')::bigint = 15000);
  begin perform public.bayar_klaim(c3, 'kas'); perform pg_temp.cek('bayar dua kali ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('bayar dua kali ditolak', true); end;

  -- Perjalanan dinas: uang muka 1.000.000, klaim 700.000, sisa 300.000 jadi kasbon.
  perform set_config('request.jwt.claims', k3, true);
  d1 := (public.ajukan_dinas('Surabaya', hari - 3, hari, 'Pameran dagang', 1000000, md5('d1')::uuid) ->> 'id')::uuid;
  begin perform public.ajukan_klaim(kt2, hari, 30000, 'Parkir bandara', null, d1, md5('c4x')::uuid); perform pg_temp.cek('klaim ke perjalanan yang belum disetujui ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('klaim ke perjalanan yang belum disetujui ditolak', true); end;
  perform set_config('request.jwt.claims', ka, true);
  perform public.putuskan_usulan((select usulan_id from public.perjalanan_dinas where id = d1), true);
  perform public.bayar_uang_muka_dinas(d1, 'bank');
  perform set_config('request.jwt.claims', k3, true);
  c4 := (public.ajukan_klaim(kt2, hari - 1, 700000, 'Hotel dan transport pameran', null, d1, md5('c4')::uuid) ->> 'id')::uuid;
  begin perform public.ajukan_klaim(kt2, hari - 10, 10000, 'Di luar tanggal', null, d1, md5('c5x')::uuid); perform pg_temp.cek('struk di luar tanggal perjalanan ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('struk di luar tanggal perjalanan ditolak', true); end;
  perform set_config('request.jwt.claims', ka, true);
  begin perform public.selesaikan_dinas(d1); perform pg_temp.cek('selesai ditolak saat klaim masih menunggu', false);
  exception when sqlstate '22023' then perform pg_temp.cek('selesai ditolak saat klaim masih menunggu', true); end;
  perform public.putuskan_usulan((select usulan_id from public.klaim where id = c4), true);
  r := public.selesaikan_dinas(d1);
  perform pg_temp.cek('selesai: 700.000 dipotong uang muka, 300.000 jadi kasbon', (r ->> 'dipotong')::bigint = 700000 and (r ->> 'kasbon')::bigint = 300000
    and (select status from public.klaim where id = c4) = 'dibayar', r::text);
  perform pg_temp.cek('kasbon sisa uang muka tercatat untuk karyawan', (select sisa = 300000 from public.kasbon where orang_id = o3));
  perform pg_temp.cek('saldo 1-160 nol setelah selesai', (select sum(b.debit) - sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-160') = 0);

  -- Staf hanya data sendiri; isolasi.
  perform set_config('request.jwt.claims', k1, true);
  perform pg_temp.cek('staf melihat klaimnya saja', (select count(*) from public.klaim) = 2 and (select count(*) from public.perjalanan_dinas) = 0);
  begin perform public.bayar_klaim(c1, 'kas'); perform pg_temp.cek('staf tidak membayar klaim', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membayar klaim', true); end;
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat klaim, kategori, perjalanan A', (select count(*) from public.klaim) + (select count(*) from public.kategori_klaim) + (select count(*) from public.perjalanan_dinas) = 0);
  begin perform public.bayar_klaim(c1, 'kas'); perform pg_temp.cek('usaha B tidak membayar klaim A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak membayar klaim A', true); end;
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
