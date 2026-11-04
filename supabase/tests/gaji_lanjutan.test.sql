-- Tes M-10: THR Permenaker 6/2016 Pasal 3 (>= 12 bulan = 1 bulan upah, kurang dari itu proporsional, < 1 bulan tidak berhak),
-- usulan THR untuk pemilik, kasbon dari kas usaha (jurnal), batas potongan PP 36/2021 Pasal 65 pada slip, peran dan isolasi.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; kad text; o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  h jsonb; r jsonb; per uuid; g text;
begin
  insert into auth.users (id, email) values (ua, 'ga@uji.local'), (ub, 'gb@uji.local'), (uc, 'gc@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Gaji A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Gaji B', 'fnb');
  execute 'reset role';
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  insert into public.anggota (perusahaan_id, user_id, peran) values (pa, uc, 'admin');
  kad := json_build_object('sub', uc, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'admin'))::text;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Sari Lama', array['karyawan'], '{"mulai": "2024-01-15"}') returning id into o1;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Komang Baru', array['karyawan'], '{"mulai": "2026-07-20"}') returning id into o2;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Wayan Minggu Lalu', array['karyawan'], '{"mulai": "2027-03-01"}') returning id into o3;
  insert into public.orang (perusahaan_id, nama, jenis, data) values (pa, 'Made Tanpa Gaji', array['karyawan'], '{"mulai": "2025-01-01"}') returning id into o4;
  insert into public.orang_rahasia (orang_id, perusahaan_id, gaji) values
    (o1, pa, '{"pokok": 3200000, "tunjangan_tetap": 400000}'), (o2, pa, '{"pokok": 3000000}'), (o3, pa, '{"pokok": 2900000}');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ka, true);
  h := public.hitung_thr('2027-03-20');
  perform pg_temp.cek('masa >= 12 bulan: 1 bulan upah pokok + tunjangan tetap',
    (select (x ->> 'thr')::numeric from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Sari Lama') = 3600000, h::text);
  perform pg_temp.cek('masa 8 bulan penuh: 8/12 x upah = 2.000.000',
    (select (x ->> 'masa_bulan')::int = 8 and (x ->> 'thr')::numeric = 2000000 from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Komang Baru'));
  perform pg_temp.cek('masa kurang dari 1 bulan tidak berhak',
    (select (x ->> 'thr')::numeric = 0 and x ->> 'catatan' like 'masa kerja kurang%' from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Wayan Minggu Lalu'));
  perform pg_temp.cek('tanpa gaji pokok: null dengan catatan',
    (select x -> 'thr' = 'null'::jsonb and x ->> 'catatan' = 'gaji pokok belum diisi' from jsonb_array_elements(h -> 'orang') x where x ->> 'nama' = 'Made Tanpa Gaji'));
  perform pg_temp.cek('batas bayar 7 hari sebelum Hari Raya', h ->> 'batas_bayar' = '2027-03-13');
  r := public.ajukan_thr('2027-03-20', md5('t1')::uuid);
  perform pg_temp.cek('usulan THR 2 orang Rp5.600.000', (r ->> 'orang')::int = 2 and (r ->> 'total')::numeric = 5600000, r::text);
  perform pg_temp.cek('usulan hanya untuk pemilik', (select untuk_peran = array['pemilik'] and aksi = 'uang.thr' from public.usulan where id = (r ->> 'usulan')::uuid));
  perform pg_temp.cek('kunci sama tidak menggandakan', (public.ajukan_thr('2027-03-20', md5('t1')::uuid) ->> 'sudah') = 'true');
  r := public.beri_kasbon(o1, 1000000, 250000, 'tunai', 'Biaya sekolah anak', md5('k1')::uuid);
  perform pg_temp.cek('kasbon tercatat dengan sisa penuh', (select sisa = 1000000 from public.kasbon where id = (r ->> 'id')::uuid));
  perform pg_temp.cek('jurnal kasbon D 1-150 / K 1-100', (select sum(b.debit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id where b.perusahaan_id = pa and a.kode = '1-150') = 1000000);
  begin perform public.beri_kasbon(o1, 100000, 200000, 'tunai', 'Cicilan terlalu besar', md5('k2')::uuid); perform pg_temp.cek('cicilan melebihi jumlah ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('cicilan melebihi jumlah ditolak', true); end;

  perform set_config('request.jwt.claims', kad, true);
  begin perform public.hitung_thr('2027-03-20'); perform pg_temp.cek('admin tidak melihat THR (data gaji)', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak melihat THR (data gaji)', true); end;
  begin perform public.beri_kasbon(o1, 100000, 100000, 'tunai', 'Uji admin', md5('k3')::uuid); perform pg_temp.cek('admin tidak memberi kasbon', false);
  exception when sqlstate '42501' then perform pg_temp.cek('admin tidak memberi kasbon', true); end;
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat orang A di THR', jsonb_array_length(public.hitung_thr('2027-03-20') -> 'orang') = 0);
  perform pg_temp.cek('usaha B tidak melihat kasbon A', (select count(*) from public.kasbon) = 0);
  begin perform public.beri_kasbon(o1, 100000, 100000, 'tunai', 'Lintas usaha', md5('k4')::uuid); perform pg_temp.cek('usaha B tidak memberi kasbon ke orang A', false);
  exception when sqlstate 'P0002' then perform pg_temp.cek('usaha B tidak memberi kasbon ke orang A', true); end;
  execute 'reset role';

  -- Batas potongan Pasal 65 pada slip: kasbon 60% ditolak, 50% lolos, pajak dan BPJS tidak dihitung.
  insert into public.periode_gaji (perusahaan_id, bulan) values (pa, '2027-02-01') returning id into per;
  begin
    insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen) values (pa, per, o1,
      '[{"kode": "pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "jenis": "potongan", "nilai": 1800000}]');
    perform pg_temp.cek('potongan kasbon 60% upah ditolak', false);
  exception when sqlstate '22023' then get stacked diagnostics g = message_text; perform pg_temp.cek('potongan kasbon 60% upah ditolak', g like '%Pasal 65%', g); end;
  insert into public.slip_gaji (perusahaan_id, periode_id, orang_id, komponen) values (pa, per, o1,
    '[{"kode": "pokok", "jenis": "pendapatan", "nilai": 3000000}, {"kode": "kasbon", "jenis": "potongan", "nilai": 1000000}, {"kode": "denda", "jenis": "potongan", "nilai": 500000}, {"kode": "pph21", "jenis": "potongan", "nilai": 900000}, {"kode": "jht", "jenis": "potongan", "nilai": 60000}]');
  perform pg_temp.cek('potongan Pasal 63 tepat 50% lolos, PPh dan BPJS tidak dihitung', exists (select 1 from public.slip_gaji where periode_id = per and orang_id = o1));
  begin
    update public.slip_gaji set komponen = komponen || '[{"kode": "utang", "jenis": "potongan", "nilai": 1}]' where periode_id = per and orang_id = o1;
    perform pg_temp.cek('ubah slip melewati batas ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('ubah slip melewati batas ditolak', true); end;
  perform pg_temp.cek('masa kerja bulan penuh', app.masa_kerja_bulan('2026-07-20', '2027-03-19') = 7 and app.masa_kerja_bulan('2026-07-20', '2027-03-20') = 8);
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
