-- Tes M-09 data faktur keluaran Coretax: identitas penjual dan pembeli divalidasi (NPWP 16, NITKU 22 diawali NPWP), hanya
-- pemilik/admin/akuntan, usaha lain terpisah, data bulan hanya invoice bulan itu yang tidak batal dengan pembeli yang cocok.
create temp table _t (nama text, ok boolean, info text);
grant all on _t to public;
create function pg_temp.cek(n text, c boolean, i text default null) returns void
language sql as $$ insert into _t values (n, coalesce(c, false), i) $$;
grant execute on function pg_temp.cek(text, boolean, text) to public;

do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); pa uuid; pb uuid; ka text; kb text; ks text; o_s uuid; u_s uuid; d jsonb; i1 jsonb; i2 jsonb;
begin
  insert into auth.users (id, email) values (ua, 'ca@uji.local'), (ub, 'cb@uji.local');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  pa := public.buat_perusahaan('Warung Faktur A', 'fnb');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  pb := public.buat_perusahaan('Warung Faktur B', 'fnb');
  ka := json_build_object('sub', ua, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'pemilik'))::text;
  kb := json_build_object('sub', ub, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pb, 'prn', 'pemilik'))::text;
  perform set_config('request.jwt.claims', ka, true);
  insert into public.orang (perusahaan_id, nama) values (pa, 'Staf Faktur') returning id into o_s;
  perform public.buat_akun_staf(o_s, '123456');
  perform public.simpan_identitas_pajak('1091.0312.1091.2281', '', true, true, '04');
  perform pg_temp.cek('NITKU bawaan = NPWP + 000000', (select nitku from public.identitas_pajak where perusahaan_id = pa) = '1091031210912281000000');
  begin perform public.simpan_identitas_pajak('12345', null, true, true, '04'); perform pg_temp.cek('NPWP pendek ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('NPWP pendek ditolak', true); end;
  begin perform public.simpan_identitas_pajak('1091031210912281', '9991031210912281000000', true, true, '04'); perform pg_temp.cek('NITKU tidak diawali NPWP ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('NITKU tidak diawali NPWP ditolak', true); end;
  perform public.simpan_pembeli_pajak('CV Maju Jaya', 'TIN', '0811034248502000', null, 'Jl. Sudirman 5, Denpasar', 'keu@majujaya.test');
  perform public.simpan_pembeli_pajak('Bu Rina', 'National ID', '5171014507800003', null, 'Jl. Teuku Umar 8, Denpasar', null);
  perform pg_temp.cek('NITKU pembeli TIN otomatis', (select nitku from public.pembeli_pajak where kunci = 'cv maju jaya') = '0811034248502000000000');
  perform pg_temp.cek('NIK tanpa NITKU', (select nitku is null from public.pembeli_pajak where kunci = 'bu rina'));
  begin perform public.simpan_pembeli_pajak('PT Salah', 'TIN', '123', null, 'Jl. X', null); perform pg_temp.cek('NPWP pembeli salah ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('NPWP pembeli salah ditolak', true); end;
  begin perform public.simpan_pembeli_pajak('Tanpa Alamat', 'Other ID', 'A123', null, '', null); perform pg_temp.cek('alamat kosong ditolak', false);
  exception when sqlstate '22023' then perform pg_temp.cek('alamat kosong ditolak', true); end;
  i1 := public.buat_invoice('CV Maju Jaya', null, '[{"uraian": "Nasi kotak", "jumlah": 30, "harga": 22000}]'::jsonb, current_date + 7, null, gen_random_uuid());
  i2 := public.buat_invoice('Pembeli Baru', null, '[{"uraian": "Es teh", "jumlah": 10, "harga": 3000}]'::jsonb, current_date + 7, null, gen_random_uuid());
  d := public.data_faktur_keluaran(current_date);
  perform pg_temp.cek('identitas ikut', d #>> '{identitas,npwp}' = '1091031210912281', d::text);
  perform pg_temp.cek('dua invoice bulan ini', jsonb_array_length(d -> 'faktur') = 2);
  perform pg_temp.cek('pembeli dicocokkan lewat nama', (select count(*) from jsonb_array_elements(d -> 'faktur') f where f #>> '{pembeli,jenis_id}' = 'TIN') = 1
    and (select count(*) from jsonb_array_elements(d -> 'faktur') f where f -> 'pembeli' = 'null'::jsonb) = 1);
  perform pg_temp.cek('bulan lain kosong', jsonb_array_length(public.data_faktur_keluaran((current_date - interval '2 months')::date) -> 'faktur') = 0);
  perform public.batal_invoice((i2 ->> 'id')::uuid, 'Salah input');
  perform pg_temp.cek('invoice batal tidak ikut', jsonb_array_length(public.data_faktur_keluaran(current_date) -> 'faktur') = 1);

  execute 'reset role';
  select user_id into u_s from public.orang where id = o_s;
  ks := json_build_object('sub', u_s, 'role', 'authenticated', 'app_metadata', json_build_object('pid', pa, 'prn', 'staf'))::text;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ks, true);
  begin perform public.data_faktur_keluaran(current_date); perform pg_temp.cek('staf tidak membaca data faktur', false);
  exception when sqlstate '42501' then perform pg_temp.cek('staf tidak membaca data faktur', true); end;
  perform pg_temp.cek('staf tidak melihat pembeli', (select count(*) from public.pembeli_pajak) = 0 and (select count(*) from public.identitas_pajak) = 0);
  perform set_config('request.jwt.claims', kb, true);
  perform pg_temp.cek('usaha B tidak melihat data A', (select count(*) from public.pembeli_pajak) = 0 and (select count(*) from public.identitas_pajak) = 0);
  d := public.data_faktur_keluaran(current_date);
  perform pg_temp.cek('usaha B tanpa identitas dan faktur', d -> 'identitas' = 'null'::jsonb and jsonb_array_length(d -> 'faktur') = 0, d::text);
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform pg_temp.cek('anon tidak membaca tabel', not has_table_privilege('anon', 'public.pembeli_pajak', 'select') and not has_function_privilege('anon', 'public.data_faktur_keluaran(date)', 'execute'));
  execute 'reset role';
end $$;

do $$
declare g text;
begin
  select string_agg(nama || coalesce(' (' || info || ')', ''), '; ') into g from _t where not ok;
  raise exception 'HASIL_TES %/% | gagal=[%]', (select count(*) from _t where ok), (select count(*) from _t), coalesce(g, '');
end $$;
