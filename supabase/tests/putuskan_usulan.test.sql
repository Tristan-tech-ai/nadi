-- Tes putuskan_usulan. Transaksi dibatalkan di akhir lewat RAISE EXCEPTION berisi hasil; lulus bila "gagal=[]".
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; o1 uuid; ks text; ka text; kb text;
  u_ktp uuid; u_impor uuid; u_nota uuid; u_tolak uuid; u_absen uuid; r jsonb; n int;
begin
  insert into auth.users (id, email) values (ua, 'a@uji.local'), (ub, 'b@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Uji A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Toko Uji B');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Sari Dewi') returning id into o1;
  perform public.buat_akun_staf(o1, '123456');
  ks := json_build_object('sub', (select user_id from public.orang where id = o1), 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'reset role';

  -- Usulan dibuat seperti oleh baca-berkas (peran layanan).
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, keyakinan) values
    (pa, 'lempar', 'orang.buat', 'Tambah AGUS', '{"jenis":"ktp","bidang":{"nik":"9921012605831840","nama":"AGUS ASTUTI","tanggal_lahir":"1983-05-26","jenis_kelamin":"L"}}', 0.9) returning id into u_ktp;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, keyakinan) values
    (pa, 'lempar', 'orang.impor', 'Tambah 3 orang', '{"jenis":"excel_karyawan","bidang":{"baris":[{"id":"K-1","nama":"Sari Dewi","jabatan":"Kasir","telepon":"","mulai":"2025-01-01","gaji_pokok":4000000},{"id":"K-2","nama":"Made Putra","jabatan":"Koki","telepon":"0812","mulai":"2024-02-01","gaji_pokok":4500000},{"id":"K-3","nama":"Wayan Sari","jabatan":"Pelayan","telepon":"","mulai":"","gaji_pokok":0}]}}', 0.95) returning id into u_impor;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload, keyakinan, dampak_rp) values
    (pa, 'lempar', 'uang.keluar', 'Catat belanja', '{"jenis":"nota","bidang":{"pemasok":"UD Sumber Rejeki","tanggal":"2026-10-13","total":376500,"baris":[]}}', 0.93, 376500) returning id into u_nota;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values
    (pa, 'lempar', 'uang.keluar', 'Catat belanja lain', '{"jenis":"nota","bidang":{"total":1000}}') returning id into u_tolak;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, payload) values
    (pa, 'lempar', 'absen.impor', 'Masukkan 2 baris absen', '{"jenis":"absen","bidang":{"baris":[{"nama":"Sari Dewi","tanggal":"2026-10-01","masuk":"07.15","pulang":"17.00","keterangan":""},{"nama":"Orang Asing","tanggal":"bukan-tanggal","masuk":"","pulang":"","keterangan":"izin"}]}}') returning id into u_absen;

  execute 'set local role authenticated';
  -- Staf tidak bisa memutuskan.
  perform set_config('request.jwt.claims', ks, true);
  begin
    perform public.putuskan_usulan(u_ktp, true);
    perform pg_temp.cek('staf tidak bisa memutuskan usulan', false, 'seharusnya ditolak');
  exception when insufficient_privilege then perform pg_temp.cek('staf tidak bisa memutuskan usulan', true); end;
  -- Pemilik usaha lain tidak bisa.
  perform set_config('request.jwt.claims', kb, true);
  begin
    perform public.putuskan_usulan(u_ktp, true);
    perform pg_temp.cek('pemilik usaha lain tidak bisa memutuskan', false, 'seharusnya ditolak');
  exception when no_data_found then perform pg_temp.cek('pemilik usaha lain tidak bisa memutuskan', true); end;

  perform set_config('request.jwt.claims', ka, true);
  r := public.putuskan_usulan(u_ktp, true);
  perform pg_temp.cek('KTP disetujui membuat satu orang', r ->> 'status' = 'diterima' and (r ->> 'dibuat')::int = 1);
  perform pg_temp.cek('nama KTP dirapikan huruf kapital awal', exists (select 1 from public.orang where perusahaan_id = pa and nama = 'Agus Astuti'));
  perform pg_temp.cek('NIK disimpan hash + 4 digit akhir', exists (select 1 from public.orang_rahasia s join public.orang o on o.id = s.orang_id where o.nama = 'Agus Astuti' and s.nik_akhir = '1840' and length(s.nik_hash) = 64));
  perform pg_temp.cek('NIK mentah dihapus dari payload usulan', (select payload -> 'bidang' ->> 'nik' from public.usulan where id = u_ktp) = '****1840');
  r := public.putuskan_usulan(u_ktp, true);
  perform pg_temp.cek('memutuskan dua kali tidak membuat orang lagi', (r ->> 'sudah')::boolean and (select count(*) from public.orang where nama = 'Agus Astuti') = 1);

  r := public.putuskan_usulan(u_impor, true);
  perform pg_temp.cek('impor Excel: 2 orang baru, 1 dilewati karena sudah ada', (r ->> 'dibuat')::int = 2 and (r ->> 'dilewati')::int = 1);
  perform pg_temp.cek('gaji pokok masuk ke orang_rahasia, bukan orang.data', exists (select 1 from public.orang_rahasia s join public.orang o on o.id = s.orang_id where o.nama = 'Made Putra' and (s.gaji ->> 'pokok')::numeric = 4500000)
    and not exists (select 1 from public.orang where nama = 'Made Putra' and data ? 'gaji_pokok'));

  -- Q-24: tanggal di nota dan jam absen dibaca di zona usaha (bawaan Asia/Jakarta, +07), bukan WITA tetap.
  r := public.putuskan_usulan(u_nota, true);
  perform pg_temp.cek('nota menjadi kejadian uang.keluar bernilai total', exists (select 1 from public.kejadian where perusahaan_id = pa and jenis = 'uang.keluar' and nilai = 376500 and terjadi_at = '2026-10-13 00:00+07'));
  perform pg_temp.cek('M-04: nota disetujui juga menjadi tagihan pemasok 376.500', exists (select 1 from public.tagihan_beli where usulan_id = u_nota and total = 376500));
  r := public.putuskan_usulan(u_tolak, false);
  perform pg_temp.cek('menolak tidak membuat kejadian', r ->> 'status' = 'ditolak' and not exists (select 1 from public.kejadian where nilai = 1000));
  perform pg_temp.cek('M-04: menolak tidak membuat tagihan', not exists (select 1 from public.tagihan_beli where usulan_id = u_tolak));
  r := public.putuskan_usulan(u_absen, true);
  perform pg_temp.cek('absen: 2 kejadian, nama dikenal ditautkan, tanggal rusak tidak menggagalkan', (r ->> 'dibuat')::int = 2
    and exists (select 1 from public.kejadian where jenis = 'absen.harian' and orang_id = o1 and terjadi_at = '2026-10-01 07:15+07'));

  perform set_config('request.jwt.claims', kb, true);
  select count(*) into n from public.kejadian;
  perform pg_temp.cek('usaha B tidak melihat kejadian usaha A', n = 0);
  execute 'reset role';
end $$;

do $$
declare total int; gagal text;
begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal;
end $$;
